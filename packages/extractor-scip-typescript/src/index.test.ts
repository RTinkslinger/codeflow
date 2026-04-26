import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { ScipTypescriptExtractor } from './index.js'
import { loadFixture, assertInvariants } from '@codeflow/test-utils'

const HAS_SCIP = (() => {
  try { execSync('scip-typescript --version', { stdio: 'ignore' }); return true }
  catch { return false }
})()

describe.skipIf(!HAS_SCIP)('ScipTypescriptExtractor', () => {
  it('extracts verified symbols from pure-ts fixture', async () => {
    const extractor = new ScipTypescriptExtractor()
    const fixturePath = loadFixture('pure-ts')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })

    expect(ir.symbols.length).toBeGreaterThan(0)
    expect(ir.symbols.every(s => s.language === 'ts')).toBe(true)
    expect(ir.symbols.every(s => s.confidence === 'verified')).toBe(true)
    assertInvariants(ir)
  }, 120_000)
})
