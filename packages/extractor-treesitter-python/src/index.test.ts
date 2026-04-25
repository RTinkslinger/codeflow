import { describe, it, expect } from 'vitest'
import { TreeSitterPythonExtractor } from './index.js'
import { loadFixture, assertInvariants } from '@codeflow/test-utils'

describe('TreeSitterPythonExtractor', () => {
  it('extracts symbols from pure-py-typed fixture', async () => {
    const extractor = new TreeSitterPythonExtractor()
    const fixturePath = loadFixture('pure-py-typed')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })

    expect(ir.symbols.length).toBeGreaterThan(0)
    expect(ir.symbols.every(s => s.language === 'py')).toBe(true)
    expect(ir.symbols.every(s => s.confidence === 'inferred')).toBe(true)
    assertInvariants(ir)
  }, 30_000)

  it('identifies import relationships', async () => {
    const extractor = new TreeSitterPythonExtractor()
    const fixturePath = loadFixture('pure-py-typed')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })
    expect(ir.relationships.some(r => r.kind === 'imports')).toBe(true)
  }, 30_000)

  it('does not extract TS files', async () => {
    const extractor = new TreeSitterPythonExtractor()
    const fixturePath = loadFixture('mixed-ts-py')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })
    expect(ir.symbols.every(s => s.language === 'py')).toBe(true)
  }, 30_000)
})
