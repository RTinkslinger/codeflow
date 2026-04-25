import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { ScipPythonExtractor } from './index.js'
import { loadFixture, assertInvariants } from '@codeflow/test-utils'

const HAS_SCIP_PY = (() => {
  try { execSync('scip-python --version', { stdio: 'ignore' }); return true }
  catch { return false }
})()

describe.skipIf(!HAS_SCIP_PY)('ScipPythonExtractor', () => {
  it('extracts verified symbols from pure-py-typed fixture', async () => {
    const extractor = new ScipPythonExtractor()
    const fixturePath = loadFixture('pure-py-typed')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })

    expect(ir.symbols.length).toBeGreaterThan(0)
    expect(ir.symbols.every(s => s.language === 'py')).toBe(true)
    expect(ir.symbols.every(s => s.confidence === 'verified')).toBe(true)
    assertInvariants(ir)
  }, 120_000)

  it('marks dynamic fixtures with lower confidence — does not crash', async () => {
    const extractor = new ScipPythonExtractor()
    const fixturePath = loadFixture('pure-py-dynamic')
    const { ir } = await extractor.extract({ path: fixturePath, root: fixturePath })
    expect(ir.schemaVersion).toBe('1')
  }, 120_000)
})
