import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Counter tracks how many times the scip-typescript extractor has been invoked.
// First call returns a verified symbol; subsequent calls return empty (simulating
// a re-extraction failure after a prior success).
const callCount = vi.hoisted(() => ({ value: 0 }))

vi.mock('@codeflow/extractor-scip-typescript', () => ({
  ScipTypescriptExtractor: class {
    async extract(opts: { path: string; root: string }) {
      callCount.value++
      if (callCount.value === 1) {
        return {
          ir: {
            schemaVersion: '1' as const,
            meta: { extractor: { name: 'scip-typescript', version: 'mock', invocation: '' }, root: opts.root },
            documents: [],
            symbols: [{
              id: 'scip:node:pkg.src/a.ts:module',
              kind: 'module' as const,
              name: 'a.ts',
              absPath: path.join(opts.root, 'a.ts'),
              relPath: 'a.ts',
              language: 'ts' as const,
              origin: 'extractor' as const,
              confidence: 'verified' as const,
            }],
            relationships: [],
          },
          durationMs: 0,
        }
      }
      // Second+ call: return empty (verified extraction failed / produced nothing)
      return {
        ir: {
          schemaVersion: '1' as const,
          meta: { extractor: { name: 'scip-typescript', version: 'mock', invocation: '' }, root: opts.root },
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

// Mock fast extractors so fastIR is reliably populated after fast extraction runs.
// Without this, fastIR could be null in hermetic CI (no depcruise binary), making
// the post-fix assertion evaluate undefined rather than false.
vi.mock('@codeflow/extractor-depcruise', () => ({
  DepcruiseExtractor: class {
    async extract(opts: { path: string; root: string }) {
      return {
        ir: {
          schemaVersion: '1' as const,
          meta: { extractor: { name: 'depcruise', version: 'mock', invocation: '' }, root: opts.root },
          documents: [{ relPath: 'a.ts', absPath: path.join(opts.root, 'a.ts'), language: 'ts' as const }],
          symbols: [{
            id: 'depcruise:node:pkg.src/a.ts:a.ts',
            kind: 'module' as const,
            name: 'a.ts',
            absPath: path.join(opts.root, 'a.ts'),
            relPath: 'a.ts',
            language: 'ts' as const,
            origin: 'extractor' as const,
            confidence: 'inferred' as const,
          }],
          relationships: [],
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

import { CodeflowMCP } from './mcp.js'

describe('CodeflowMCP verified lane — stale verifiedIR cleared on re-extraction failure', () => {
  it('clears verifiedIR so getIR returns inferred symbols after verified re-extraction returns empty', async () => {
    // Bug: after verified extraction succeeds (verifiedIR set) and a subsequent
    // re-extraction returns empty symbols, verifiedIR is NOT cleared.
    // getIR returns stale verified symbols instead of current fast (inferred) symbols.
    // Fix: set record.verifiedIR = null in both failure branches of runVerifiedExtraction.
    callCount.value = 0

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-stale-ir-test-'))
    const mcp = new CodeflowMCP()

    try {
      const tsFile = path.join(tmpDir, 'a.ts')
      fs.writeFileSync(tsFile, `export const x = 1`)

      const { previewId } = await mcp.startPreview({ path: tmpDir, verified: true })

      // Wait for first verified extraction to complete (scip mock call #1 returns verified symbol)
      let firstResult = null
      const deadline1 = Date.now() + 30_000
      while (Date.now() < deadline1) {
        firstResult = await mcp.getIR({ previewId })
        if (firstResult.ir?.symbols.some(s => s.confidence === 'verified')) break
        await new Promise(r => setTimeout(r, 200))
      }
      expect(firstResult!.ir?.symbols.some(s => s.confidence === 'verified')).toBe(true)

      // Trigger re-extraction: file watcher debounces at 200ms + stabilityThreshold 150ms
      fs.writeFileSync(tsFile, `export const x = 2`)

      // Wait for re-extraction to complete (watcher fires, fast+verified re-run,
      // scip mock call #2 returns empty)
      let secondResult = null
      const deadline2 = Date.now() + 30_000
      while (Date.now() < deadline2) {
        secondResult = await mcp.getIR({ previewId })
        // After fix: verifiedIR cleared → getIR returns fastIR → no verified symbols
        // After re-extraction, fastIR is updated. Poll until we see the file has been re-processed
        // (callCount.value >= 2 means second verified extraction ran)
        if (callCount.value >= 2 && secondResult.ir && !secondResult.ir.symbols.some(s => s.confidence === 'verified')) break
        await new Promise(r => setTimeout(r, 300))
      }

      // After fix: stale verifiedIR cleared → only inferred symbols remain
      expect(secondResult).not.toBeNull()
      // After fix: verifiedIR cleared → getIR returns fastIR (inferred symbol from depcruise mock)
      expect(secondResult!.ir).not.toBeNull()
      expect(secondResult!.ir!.symbols.some(s => s.confidence === 'verified')).toBe(false)
      expect(secondResult!.ir!.symbols.some(s => s.confidence === 'inferred')).toBe(true)
    } finally {
      await mcp.shutdown()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }, 60_000)
})
