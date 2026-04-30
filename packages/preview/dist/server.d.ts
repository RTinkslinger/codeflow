import http from 'node:http';
interface PortRange {
    start: number;
    end: number;
}
export declare function allocatePort(range: PortRange): Promise<number>;
export declare const PREVIEW_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>codeflow</title>\n  <style>\n    body { margin: 0; background: #0f1117; color: #e4e4ef; font-family: 'JetBrains Mono', monospace; }\n    #status { padding: 8px 16px; background: #1a1d27; border-bottom: 1px solid #2a2d3a; font-size: 12px; display: flex; align-items: center; gap: 8px; }\n    #dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }\n    #dot.ready { background: #10b981; }\n    #dot.error { background: #ef4444; }\n    #graph { padding: 24px; }\n    .mermaid { background: transparent; }\n  </style>\n</head>\n<body>\n  <div id=\"status\"><span id=\"dot\"></span><span id=\"label\">connecting...</span></div>\n  <div id=\"graph\"><div class=\"mermaid\" id=\"diagram\"></div></div>\n  <script src=\"https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js\"></script>\n  <script>\n    mermaid.initialize({\n      startOnLoad: false,\n      theme: 'dark',\n      // Codeflow produces large IRs on real monorepos (codeflow itself has\n      // ~2k symbols + 8k relationships). Mermaid's default 50KB / 500-edge\n      // limits block them. Bump to 5MB / 10k edges; v1.1 can introduce\n      // sampling/collapsing for huge projects.\n      maxTextSize: 5_000_000,\n      maxEdges: 10_000,\n    });\n    const ws = new WebSocket('ws://' + location.host + '/ws');\n    ws.onmessage = async (e) => {\n      const msg = JSON.parse(e.data);\n      if (msg.type === 'update') {\n        document.getElementById('diagram').innerHTML = msg.mermaid;\n        document.getElementById('label').textContent = msg.badge ?? 'ready';\n        document.getElementById('dot').className = 'ready';\n        await mermaid.run({ nodes: [document.getElementById('diagram')] });\n      } else if (msg.type === 'error') {\n        document.getElementById('label').textContent = 'error: ' + msg.error.code;\n        document.getElementById('dot').className = 'error';\n      } else if (msg.type === 'stale') {\n        location.reload();\n      } else if (msg.type === 'verified_ready') {\n        document.getElementById('diagram').innerHTML = msg.mermaid;\n        document.getElementById('label').textContent = msg.badge ?? '\u25CF verified';\n        document.getElementById('dot').className = 'ready';\n        await mermaid.run({ nodes: [document.getElementById('diagram')] });\n      }\n    };\n    ws.onopen = () => {\n      sessionStorage.removeItem('cf_delay');\n      document.getElementById('label').textContent = 'extracting...';\n    };\n    ws.onclose = () => {\n      // Exponential backoff persisted via sessionStorage so it survives location.reload()\n      const delay = Math.min(parseInt(sessionStorage.getItem('cf_delay') || '1000'), 30000);\n      sessionStorage.setItem('cf_delay', String(Math.min(delay * 2, 30000)));\n      setTimeout(() => location.reload(), delay);\n    };\n  </script>\n</body>\n</html>";
export declare class PreviewServer {
    private httpServer;
    private _port;
    start(portRange?: PortRange): Promise<{
        port: number;
        url: string;
    }>;
    private tryBind;
    get server(): http.Server | null;
    get port(): number;
    stop(): Promise<void>;
}
export {};
//# sourceMappingURL=server.d.ts.map