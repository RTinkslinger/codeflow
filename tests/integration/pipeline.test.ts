import { describe, it, expect } from 'vitest'
import { DepcruiseExtractor } from '@codeflow/extractor-depcruise'
import { TreeSitterPythonExtractor } from '@codeflow/extractor-treesitter-python'
import { mergeIRs } from '@codeflow/core'
import { canonicalMerge, InvariantError } from '@codeflow/canonical'
import { renderMermaid } from '@codeflow/renderer-mermaid'
import { assertInvariants, loadFixture } from '@codeflow/test-utils'

describe('Full pipeline — fast lane', () => {
  it('pure-ts: extract → merge → render produces valid Mermaid', async () => {
    const p = loadFixture('pure-ts')
    const extractor = new DepcruiseExtractor()
    const { ir } = await extractor.extract({ path: p, root: p })
    const merged = mergeIRs([ir])
    assertInvariants(merged)
    const mermaid = renderMermaid(merged)
    expect(mermaid).toMatch(/^graph/)
    expect(merged.symbols.length).toBeGreaterThan(0)
  }, 60_000)

  it('mixed-ts-py: both languages present in merged IR', async () => {
    const p = loadFixture('mixed-ts-py')
    const ts = new DepcruiseExtractor()
    const py = new TreeSitterPythonExtractor()
    const [tsR, pyR] = await Promise.all([
      ts.extract({ path: p, root: p }),
      py.extract({ path: p, root: p }),
    ])
    const merged = mergeIRs([tsR.ir, pyR.ir])
    const langs = new Set(merged.symbols.map(s => s.language))
    expect(langs.has('ts')).toBe(true)
    expect(langs.has('py')).toBe(true)
  }, 60_000)
})

describe('Canonicalizer stress — cross-extractor same-path dedup', () => {
  it('depcruise + scip-ts both see same .ts file → canonicalMerge produces ONE node', () => {
    // Simulate two extractors producing different symbol IDs for the same file on disk
    const absPath = '/p/src/auth.ts'
    const relPath = 'src/auth.ts'
    const symA = { id: 'depcruise:node:src/auth.ts:auth.ts', kind: 'module' as const, name: 'auth.ts', absPath, relPath, language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }
    const symB = { id: 'scip:typescript:src/auth:AuthService', kind: 'class' as const, name: 'AuthService', absPath, relPath, language: 'ts' as const, origin: 'extractor' as const, confidence: 'verified' as const }

    // Before canonical merge: two different IDs map to the same path
    const uniquePaths = [...new Set([symA, symB].map(s => s.absPath))]
    expect(uniquePaths).toHaveLength(1)

    // After canonical merge: one winner per path
    const { symbols } = canonicalMerge([symA, symB], '/p')
    expect(symbols).toHaveLength(1)

    // Winner should have promoted to verified confidence
    expect(symbols[0]!.confidence).toBe('verified')

    // assertInvariants checks absPath uniqueness
    assertInvariants({ symbols })
  })

  it('same id, different paths → InvariantError thrown', () => {
    const symA = { id: 'collision:id', kind: 'function' as const, name: 'fn', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }
    const symB = { id: 'collision:id', kind: 'function' as const, name: 'fn', absPath: '/p/b.ts', relPath: 'b.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }
    expect(() => canonicalMerge([symA, symB], '/p')).toThrow(InvariantError)
  })
})
