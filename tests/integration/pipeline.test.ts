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
  it('depcruise + scip-ts both emit FILE-LEVEL symbols for same .ts → canonicalMerge produces ONE file-node', () => {
    // depcruise emits kind:'module' for the file; scip-ts emits kind:'file' (M1+).
    // Both file-level → collide on absPath → dedupe to one.
    const absPath = '/p/src/auth.ts'
    const relPath = 'src/auth.ts'
    const depcruiseFile = { id: 'depcruise:node:src/auth.ts:auth.ts', kind: 'module' as const, name: 'auth.ts', absPath, relPath, language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }
    const scipFile = { id: 'file::/p/src/auth.ts', kind: 'file' as const, name: 'auth.ts', absPath, relPath, language: 'ts' as const, origin: 'extractor' as const, confidence: 'verified' as const }

    const { symbols } = canonicalMerge([depcruiseFile, scipFile], '/p')

    // Both file-level for the same file → exactly one survives
    const fileLevel = symbols.filter(s => s.kind === 'module' || s.kind === 'file')
    expect(fileLevel).toHaveLength(1)

    // Winner should have promoted to verified confidence
    expect(fileLevel[0]!.confidence).toBe('verified')

    assertInvariants({ symbols })
  })

  it('depcruise file-symbol + scip class Definition in same file → BOTH preserved (not deduped)', () => {
    // Multiple non-file Definitions in a file are distinct nodes; the file-symbol
    // is also distinct. Pre-M2 the merger collapsed them all into one — bug fixed.
    const absPath = '/p/src/auth.ts'
    const relPath = 'src/auth.ts'
    const fileSymbol = { id: 'depcruise:node:src/auth.ts:auth.ts', kind: 'module' as const, name: 'auth.ts', absPath, relPath, language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }
    const classDef = { id: 'scip:typescript:src/auth:AuthService', kind: 'class' as const, name: 'AuthService', absPath, relPath, language: 'ts' as const, origin: 'extractor' as const, confidence: 'verified' as const }

    const { symbols } = canonicalMerge([fileSymbol, classDef], '/p')
    expect(symbols).toHaveLength(2)
    expect(symbols.find(s => s.kind === 'module')).toBeDefined()
    expect(symbols.find(s => s.kind === 'class')).toBeDefined()

    assertInvariants({ symbols })
  })

  it('same id, different paths → InvariantError thrown', () => {
    const symA = { id: 'collision:id', kind: 'function' as const, name: 'fn', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }
    const symB = { id: 'collision:id', kind: 'function' as const, name: 'fn', absPath: '/p/b.ts', relPath: 'b.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }
    expect(() => canonicalMerge([symA, symB], '/p')).toThrow(InvariantError)
  })
})
