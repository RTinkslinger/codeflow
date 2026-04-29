import { describe, it, expect, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { CodeflowMCP } from './mcp.js'

const FIXTURE = path.resolve(__dirname, '../../test-utils/fixtures/monorepo-3pkg-ts')

const HAS_SCIP_TS = (() => { try { execSync('scip-typescript --version', { stdio: 'ignore' }); return true } catch { return false } })()

describe.skipIf(!HAS_SCIP_TS)('mcp workspaceWarnings broadcast', () => {
  let mcp: CodeflowMCP | undefined
  const broadcasts: any[] = []

  afterEach(async () => {
    if (mcp) {
      const list = await mcp.listPreviews()
      for (const p of list) await mcp.stopPreview({ previewId: p.previewId })
    }
    broadcasts.length = 0
  })

  it('emits workspaceWarnings on partial verified failure (pkg-c broken)', async () => {
    mcp = new CodeflowMCP()

    const { previewId } = await mcp.startPreview({ path: FIXTURE, verified: true })

    // Hook into the preview's broadcaster after creation — patch its broadcast method
    const previews = (mcp as any).previews as Map<string, any>
    const record = previews.get(previewId)
    if (!record) throw new Error('preview record not found')
    const origBroadcast = record.broadcaster.broadcast.bind(record.broadcaster)
    record.broadcaster.broadcast = (msg: any) => {
      broadcasts.push(msg)
      origBroadcast(msg)
    }

    // Wait up to 90s for verified to complete
    const start = Date.now()
    while (Date.now() - start < 90_000) {
      if (broadcasts.some(m => m.type === 'verified_ready')) break
      await new Promise(r => setTimeout(r, 500))
    }

    const verified = broadcasts.findLast((m: any) => m.type === 'verified_ready')
    expect(verified, 'verified_ready broadcast not received within 90s').toBeDefined()
    expect(verified.workspaceWarnings).toBeDefined()
    expect(verified.workspaceWarnings.length).toBeGreaterThan(0)
    const cWarning = verified.workspaceWarnings.find((w: any) => w.workspacePath.includes('pkg-c'))
    expect(cWarning).toBeDefined()
    expect(cWarning.code).toBe('SOURCE_PARSE_FAILED')
    expect(cWarning.diagId).toMatch(/^[\w-]+$/)
  }, 120_000)
})
