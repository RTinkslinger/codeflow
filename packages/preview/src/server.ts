import http from 'node:http'

interface PortRange { start: number; end: number }

export async function allocatePort(range: PortRange): Promise<number> {
  for (let port = range.start; port <= range.end; port++) {
    // port 0 is an OS sentinel (assigns random port) — skip in range; tryBind(0) handles it
    if (port > 0 && await isPortFree(port)) return port
  }
  return getOSPort()
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = http.createServer()
    server.listen(port, '127.0.0.1', () => { server.close(() => resolve(true)) })
    server.on('error', () => resolve(false))
  })
}

function getOSPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      server.close(() => {
        if (addr && typeof addr === 'object') resolve(addr.port)
        else reject(new Error('Could not get OS-assigned port'))
      })
    })
  })
}

const PREVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>codeflow</title>
  <style>
    body { margin: 0; background: #0f1117; color: #e4e4ef; font-family: 'JetBrains Mono', monospace; }
    #status { padding: 8px 16px; background: #1a1d27; border-bottom: 1px solid #2a2d3a; font-size: 12px; display: flex; align-items: center; gap: 8px; }
    #dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }
    #dot.ready { background: #10b981; }
    #dot.error { background: #ef4444; }
    #graph { padding: 24px; }
    .mermaid { background: transparent; }
  </style>
</head>
<body>
  <div id="status"><span id="dot"></span><span id="label">connecting...</span></div>
  <div id="graph"><div class="mermaid" id="diagram"></div></div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    const ws = new WebSocket('ws://' + location.host + '/ws');
    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'update') {
        document.getElementById('diagram').innerHTML = msg.mermaid;
        document.getElementById('label').textContent = msg.badge ?? 'ready';
        document.getElementById('dot').className = 'ready';
        await mermaid.run({ nodes: [document.getElementById('diagram')] });
      } else if (msg.type === 'error') {
        document.getElementById('label').textContent = 'error: ' + msg.error.code;
        document.getElementById('dot').className = 'error';
      } else if (msg.type === 'stale') {
        location.reload();
      }
    };
    ws.onopen = () => {
      sessionStorage.removeItem('cf_delay');
      document.getElementById('label').textContent = 'extracting...';
    };
    ws.onclose = () => {
      // Exponential backoff persisted via sessionStorage so it survives location.reload()
      const delay = Math.min(parseInt(sessionStorage.getItem('cf_delay') || '1000'), 30000);
      sessionStorage.setItem('cf_delay', String(Math.min(delay * 2, 30000)));
      setTimeout(() => location.reload(), delay);
    };
  </script>
</body>
</html>`

export class PreviewServer {
  private httpServer: http.Server | null = null
  private _port: number = 0

  async start(portRange: PortRange = { start: 7800, end: 7900 }): Promise<{ port: number; url: string }> {
    const candidate = await allocatePort(portRange)
    // tryBind handles the TOCTOU race: if port is stolen between isPortFree and listen,
    // the EADDRINUSE error triggers a fallback to OS-assigned port (port 0).
    try {
      this._port = await this.tryBind(candidate)
    } catch {
      this._port = await this.tryBind(0)
    }
    return { port: this._port, url: `http://127.0.0.1:${this._port}` }
  }

  private tryBind(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(PREVIEW_HTML)
      })
      // Attach error listener before listen() to avoid ordering hazard
      srv.once('error', (err) => {
        srv.close()
        reject(err)
      })
      srv.listen(port, '127.0.0.1', () => {
        const addr = srv.address()
        this.httpServer = srv
        // For port 0, resolve to the OS-assigned port
        resolve(addr && typeof addr === 'object' ? addr.port : port)
      })
    })
  }

  get server(): http.Server | null { return this.httpServer }
  get port(): number { return this._port }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this.httpServer) { resolve(); return }
      this.httpServer.close((err) => { if (err) reject(err); else resolve() })
    })
    this.httpServer = null
  }
}
