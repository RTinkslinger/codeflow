import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Mock scip extractors to deterministically return empty IRs.
// This makes the test environment-independent: it exercises the exact bug path
// (irs.length > 0 with documents: []) regardless of whether scip binaries are installed.
vi.mock('@codeflow/extractor-scip-typescript', () => ({
  ScipTypescriptExtractor: class {
    async extract() {
      return {
        ir: {
          schemaVersion: '1' as const,
          meta: { extractor: { name: 'scip-typescript', version: 'mock', invocation: '' }, root: '' },
          documents: [], symbols: [], relationships: [],
        },
        durationMs: 0,
      }
    }
  },
}))

vi.mock('@codeflow/extractor-scip-python', () => ({
  ScipPythonExtractor: class {
    async extract() {
      return {
        ir: {
          schemaVersion: '1' as const,
          meta: { extractor: { name: 'scip-python', version: 'mock', invocation: '' }, root: '' },
          documents: [], symbols: [], relationships: [],
        },
        durationMs: 0,
      }
    }
  },
}))

import { CodeflowMCP } from './mcp.js'

describe('CodeflowMCP verified extraction — empty IR guard', () => {
  it('does not overwrite fast lane IR when both scip extractors return empty IRs', async () => {
    // Bug: irs.length > 0 passes (both mock extractors fulfill with empty IR),
    //      empty verifiedIR stored, getIR returns verifiedIR → 0 symbols.
    // Fix: irs.some(ir => ir.symbols.length > 0) is false → verifiedIR stays null
    //      → getIR returns fastIR from depcruise → symbols present and inferred.
    // Note: scip extractor always returns documents: [], so the check must use symbols, not documents.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow-empty-ir-test-'))
    const mcp = new CodeflowMCP()
    try {
      fs.writeFileSync(path.join(tmpDir, 'a.ts'), `export const x = 1`)
      fs.writeFileSync(path.join(tmpDir, 'b.ts'), `import { x } from './a'\nexport const y = x + 1`)

      const { previewId } = await mcp.startPreview({ path: tmpDir, verified: true })

      const deadline = Date.now() + 60_000
      let result
      while (Date.now() < deadline) {
        result = await mcp.getIR({ previewId })
        if (result.status === 'ready') break
        await new Promise(r => setTimeout(r, 500))
      }

      // Fast IR should survive: depcruise symbols for the two .ts files
      expect(result!.ir).not.toBeNull()
      expect(result!.ir!.symbols.length).toBeGreaterThan(0)
      // All symbols from the fast lane carry confidence: 'inferred'
      // (a leaked empty verifiedIR has 0 symbols; a scip verifiedIR would have 'verified')
      expect(result!.ir!.symbols.every(s => s.confidence === 'inferred')).toBe(true)
    } finally {
      await mcp.shutdown()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }, 90_000)
})
