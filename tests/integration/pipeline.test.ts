import { describe, it, expect } from 'vitest'
import { DepcruiseExtractor } from '@codeflow/extractor-depcruise'
import { TreeSitterPythonExtractor } from '@codeflow/extractor-treesitter-python'
import { mergeIRs } from '@codeflow/core'
import { canonicalMerge } from '@codeflow/canonical'
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

describe('Canonicalizer stress — ts-codegen-py', () => {
  it('TS generator.ts and PY user_model.py appear as separate nodes — NOT merged', async () => {
    const p = loadFixture('ts-codegen-py')
    const ts = new DepcruiseExtractor()
    const py = new TreeSitterPythonExtractor()
    const [tsR, pyR] = await Promise.all([
      ts.extract({ path: p, root: p }),
      py.extract({ path: p, root: p }),
    ])
    const merged = mergeIRs([tsR.ir, pyR.ir])

    // depcruise produces file-level module symbols; ts-codegen-py has ts/src/generator.ts
    const tsSymbols = merged.symbols.filter(s => s.language === 'ts')
    // tree-sitter-python produces module symbol named after basename-without-.py
    const pyUserModel = merged.symbols.filter(s => s.language === 'py' && s.name.toLowerCase().includes('user'))

    expect(tsSymbols.length).toBeGreaterThan(0)
    expect(pyUserModel.length).toBeGreaterThan(0)

    // No duplicate IDs across language boundary
    assertInvariants(merged)

    // canonicalMerge must not collapse cross-language symbols
    const { symbols } = canonicalMerge(merged.symbols, p, merged.relationships)
    assertInvariants({ symbols })
    const canonTsSymbols = symbols.filter(s => s.language === 'ts')
    const canonPySymbols = symbols.filter(s => s.language === 'py')
    expect(canonTsSymbols.length).toBeGreaterThan(0)
    expect(canonPySymbols.length).toBeGreaterThan(0)
  }, 60_000)
})
