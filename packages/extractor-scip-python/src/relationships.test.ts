import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipPythonExtractor } from './index.js'

const FIXTURE_B = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg-py/pkg-b')

describe('scip-python: file-symbols + relationships', () => {
  it('emits file-symbols and reference relationships', async () => {
    const ex = new ScipPythonExtractor()
    const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B })

    expect(result.ir.symbols.some(s => s.kind === 'file')).toBe(true)
    expect(result.ir.relationships.length).toBeGreaterThan(0)

    const symIds = new Set(result.ir.symbols.map(s => s.id))
    for (const r of result.ir.relationships) {
      expect(r.from.startsWith('file::')).toBe(true)
      expect(symIds.has(r.from)).toBe(true)
    }

    // scip-python emits non-zero roles for refs; we treat all non-Definition non-local as 'references'
    expect(result.ir.relationships.every(r => r.kind === 'imports' || r.kind === 'references')).toBe(true)
    expect(result.ir.relationships.some(r => r.kind === 'references')).toBe(true)
  }, 120_000)
})
