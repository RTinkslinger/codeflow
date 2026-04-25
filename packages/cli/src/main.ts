import { CodeflowMCP } from './mcp.js'
import { createLogger } from '@codeflow/core'

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
    handleRequest(line.trim()).catch(err => logger.error({ err }, 'request handler error'))
  }
})

process.stdin.on('end', async () => { await mcp.shutdown(); process.exit(0) })

async function handleRequest(line: string): Promise<void> {
  let req: { id: unknown; method: string; params?: Record<string, unknown> }
  try { req = JSON.parse(line) }
  catch { return }

  try {
    let result: unknown
    switch (req.method) {
      case 'start_preview': result = await mcp.startPreview(req.params as { path: string }); break
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
