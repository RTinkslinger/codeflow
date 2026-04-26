import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Both fast extractors return empty IRs — exercises the bug where irs.length > 0
// passes even when no symbols exist, causing fastIR to be set to an empty IR.
vi.mock('@codeflow/extractor-depcruise', () => ({
  DepcruiseExtractor: class {
    async extract() {
      return {
        ir: {
          schemaVersion: '1' as const,
          meta: { extractor: { name: 'depcruise', version: 'mock', invocation: '' }, root: '' },
          documents: [], symbols: [], relationships: [],
        },
        durationMs: 0,
      }
    }
  },
}))

vi.mock('@codeflow/extractor-treesitter-python', () => ({
  TreeSitterPythonExtractor: class {
    async extract() {
      return {
        ir: {
          schemaVersion: '1' as const,
          meta: { extractor: { name: 'treesitter-python', version: 'mock', invocation: '' }, root: '' },
          documents: [], symbols: [], relationships: [],
        },
        durationMs: 0,
      }
    }
  },
}))

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

describe('CodeflowMCP fast extraction — empty IR guard', () => {
  it('returns null IR when both fast extractors produce zero symbols', async () => {
    // Bug: irs.length > 0 is true (both extractors fulfill), so the success branch
    // runs, sets fastIR to an empty IR (0 symbols), and getIR returns that empty IR.
    // Fix: irs.some(ir => ir.symbols.length > 0) = false → error branch → fastIR stays null.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-fast-empty-'))
    const mcp = new CodeflowMCP()
    try {
      const { previewId } = await mcp.startPreview({ path: tmpDir })

      // Mocks are synchronous — extraction completes immediately after startPreview returns.
      // Small delay ensures the async runFastExtraction promise has resolved.
      await new Promise(r => setTimeout(r, 500))

      const result = await mcp.getIR({ previewId })

      // When both fast extractors produce zero symbols, fastIR should remain null.
      // Before the fix: result.ir is an empty IR (symbols.length === 0), not null.
      expect(result.ir).toBeNull()
    } finally {
      await mcp.shutdown()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }, 10_000)
})
