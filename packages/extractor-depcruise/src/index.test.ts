import { describe, it, expect } from 'vitest'
import { DepcruiseExtractor } from './index.js'
import { loadFixture, assertInvariants } from '@codeflow/test-utils'

describe('DepcruiseExtractor', () => {
  it('extracts symbols from pure-ts fixture', async () => {
    const extractor = new DepcruiseExtractor()
    const fixturePath = loadFixture('pure-ts')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })

    expect(ir.schemaVersion).toBe('1')
    expect(ir.symbols.length).toBeGreaterThan(0)
    expect(ir.symbols.every(s => s.language === 'ts')).toBe(true)
    expect(ir.symbols.every(s => s.confidence === 'inferred')).toBe(true)
    assertInvariants(ir)
  }, 30_000)

  it('all extracted symbols have valid relPath under root', async () => {
    const extractor = new DepcruiseExtractor()
    const fixturePath = loadFixture('pure-ts')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })

    for (const sym of ir.symbols) {
      expect(sym.relPath.startsWith('/')).toBe(false)
      expect(sym.relPath).not.toContain('..')
    }
  }, 30_000)

  it('extracts import relationships', async () => {
    const extractor = new DepcruiseExtractor()
    const fixturePath = loadFixture('pure-ts')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })

    expect(ir.relationships.length).toBeGreaterThan(0)
    expect(ir.relationships.every(r => r.kind === 'imports')).toBe(true)
  }, 30_000)
})
