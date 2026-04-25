import { CodeflowMCP } from './mcp.js'
import { createLogger } from '@codeflow/core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')) as { version: string }

const args = process.argv.slice(2)

// Handle --version flag (required by smoke test and doctor)
if (args[0] === '--version' || args[0] === '-v') {
  process.stdout.write(pkg.version + '\n')
  process.exit(0)
}

// Handle one-shot render_once <path> (required by smoke test)
if (args[0] === 'render_once' && args[1]) {
  const mcp = new CodeflowMCP()
  mcp.renderOnce({ path: args[1] })
    .then(({ filePath }) => {
      process.stdout.write(JSON.stringify({ filePath }) + '\n')
      process.exit(0)
    })
    .catch(err => {
      process.stderr.write(String(err) + '\n')
      process.exit(1)
    })
} else {
  // MCP JSON-RPC stdio mode
  const logger = createLogger('info')
  const mcp = new CodeflowMCP()

  process.stdin.setEncoding('utf-8')
  let buf = ''

  process.stdin.on('data', (chunk: string) => {
    buf += chunk
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      handleRequest(mcp, line.trim(), logger).catch(err => logger.error({ err }, 'request error'))
    }
  })

  process.stdin.on('end', async () => { await mcp.shutdown(); process.exit(0) })
}

async function handleRequest(mcp: CodeflowMCP, line: string, logger: ReturnType<typeof createLogger>): Promise<void> {
  let req: { id: unknown; method: string; params?: Record<string, unknown> }
  try { req = JSON.parse(line) }
  catch { return }
  try {
    let result: unknown
    switch (req.method) {
      case 'start_preview': result = await mcp.startPreview(req.params as { path: string; verified?: boolean }); break
      case 'list_previews': result = await mcp.listPreviews(); break
      case 'stop_preview': result = await mcp.stopPreview(req.params as { previewId: string }); break
      case 'get_ir': result = await mcp.getIR(req.params as { previewId: string }); break
      case 'render_once': result = await mcp.renderOnce(req.params as { path: string }); break
      default: throw new Error(`Unknown method: ${req.method}`)
    }
    process.stdout.write(JSON.stringify({ id: req.id, result }) + '\n')
  } catch (err) {
    process.stdout.write(JSON.stringify({ id: req.id, error: { message: String(err) } }) + '\n')
  }
}
