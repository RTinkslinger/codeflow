import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { canonicalMerge } from './merger.js'
import { InvariantError } from './errors.js'

const sym = (id: string, confidence: 'inferred' | 'verified' = 'inferred') => ({
  id, kind: 'function' as const, name: id, absPath: `/p/${id}.ts`, relPath: `${id}.ts`,
  language: 'ts' as const, origin: 'extractor' as const, confidence,
})

describe('canonicalMerge — one file on disk → one node', () => {
  it('deduplicates symbols by canonicalized absPath', () => {
    const a = { ...sym('tsc:typescript:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' }
    const b = { ...sym('scip:typescript:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' }
    const result = canonicalMerge([a, b], '/p')
    expect(result.symbols).toHaveLength(1)
  })

  it('throws InvariantError on irreconcilable id collision', () => {
    // Same id, different absPath — canonicalizer cannot merge these
    const x = { ...sym('id:collision'), absPath: '/p/a.ts', relPath: 'a.ts' }
    const y = { ...sym('id:collision'), absPath: '/p/b.ts', relPath: 'b.ts' }
    expect(() => canonicalMerge([x, y], '/p')).toThrow(InvariantError)
  })

  it('property: output symbol count <= input symbol count', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 10 }),
      (ids) => {
        const symbols = ids.map(id => sym(`tsc:ts:src/${id}:fn`))
        const result = canonicalMerge(symbols, '/p')
        expect(result.symbols.length).toBeLessThanOrEqual(symbols.length)
      }
    ))
  })
})
