import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { ScipTypescriptExtractor } from './index.js'

const HAS_SCIP = (() => {
  try { execSync('scip-typescript --version', { stdio: 'ignore' }); return true }
  catch { return false }
})()

const FIXTURE_A = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg/pkg-a')

describe.skipIf(!HAS_SCIP)('scip-typescript: human-readable symbol names', () => {
  it('extracts readable names from SCIP descriptors', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE_A, root: FIXTURE_A })

    const names = result.ir.symbols.filter(s => s.kind !== 'file').map(s => s.name)

    // Expected named symbols from the fixture
    expect(names).toContain('defaultGreeting')
    expect(names).toContain('namedGreeting')
    expect(names).toContain('Greeter')
    expect(names).toContain('reExportedFn')

    // None of the names should contain SCIP descriptor noise
    for (const name of names) {
      expect(name).not.toMatch(/^scip-typescript /)
      expect(name).not.toContain(' npm ')
      // No raw SCIP suffix punctuation: backticks, method parens, type/term markers
      // Note: dots are allowed in filenames (e.g. `sub.ts` is a valid module-scope name)
      expect(name).not.toMatch(/[`(){}#]/)
      // Must not end with a bare SCIP suffix (. or # or : or [])
      expect(name).not.toMatch(/[.#:[\]]+$/)
    }
  }, 120_000)
})
