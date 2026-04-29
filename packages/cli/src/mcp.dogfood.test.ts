import { describe, it, expect, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { CodeflowMCP } from './mcp.js'

const REPO_ROOT = path.resolve(__dirname, '../../..')

const HAS_SCIP_TS = (() => {
  try { execSync('scip-typescript --version', { stdio: 'ignore' }); return true }
  catch { return false }
})()

const SHOULD_RUN = process.env.RUN_DOGFOOD === '1' && HAS_SCIP_TS

describe.skipIf(!SHOULD_RUN)('dogfood — codeflow repo verified mode', () => {
  let mcp: CodeflowMCP | undefined

  afterEach(async () => {
    if (mcp) {
      const list = await mcp.listPreviews()
      for (const p of list) await mcp.stopPreview({ previewId: p.previewId })
    }
  })

  it('produces ≥10 workspaces and ≥1 cross-workspace edge', async () => {
    mcp = new CodeflowMCP()
    const { previewId } = await mcp.startPreview({ path: REPO_ROOT, verified: true })

    // Poll for verified IR up to 120s
    const start = Date.now()
    let ir: any
    while (Date.now() - start < 120_000) {
      const out = await mcp.getIR({ previewId })
      if (out.ir?.symbols.some((s: any) => s.confidence === 'verified' && s.workspaceRel)) {
        ir = out.ir
        break
      }
      await new Promise(r => setTimeout(r, 1_000))
    }
    expect(ir, 'verified IR with workspace symbols did not arrive within 120s').toBeDefined()

    const workspaceCount = Object.keys(ir.meta.workspaces ?? {}).length
    expect(workspaceCount, 'expected ≥10 workspaces').toBeGreaterThanOrEqual(10)

    // Cross-workspace edges
    const symById = new Map<string, string | undefined>(ir.symbols.map((s: any) => [s.id, s.workspaceRel]))
    const crossEdges = ir.relationships.filter((r: any) => {
      const fromWs = symById.get(r.from)
      const toWs = symById.get(r.to)
      return fromWs && toWs && fromWs !== toWs
    })
    expect(crossEdges.length, 'expected ≥1 cross-workspace edge').toBeGreaterThanOrEqual(1)
  }, 180_000)
})
