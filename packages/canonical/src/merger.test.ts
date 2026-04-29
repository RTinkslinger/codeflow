import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { canonicalMerge } from './merger.js'
import { InvariantError } from './errors.js'

const sym = (id: string, confidence: 'inferred' | 'verified' = 'inferred') => ({
  id, kind: 'function' as const, name: id, absPath: `/p/${id}.ts`, relPath: `${id}.ts`,
  language: 'ts' as const, origin: 'extractor' as const, confidence,
})

const fileSym = (id: string, absPath: string, confidence: 'inferred' | 'verified' = 'inferred') => ({
  id, kind: 'file' as const, name: absPath.split('/').pop() ?? absPath,
  absPath, relPath: absPath.replace(/^\/p\//, ''),
  language: 'ts' as const, origin: 'extractor' as const, confidence,
})

describe('canonicalMerge — one file on disk → one file-node', () => {
  it('deduplicates FILE-LEVEL symbols by canonicalized absPath', () => {
    const a = fileSym('tsc:typescript:src/a', '/p/a.ts')
    const b = fileSym('scip:typescript:src/a', '/p/a.ts')
    const result = canonicalMerge([a, b], '/p')
    expect(result.symbols).toHaveLength(1)
  })

  it('does NOT dedupe non-file symbols sharing absPath (multiple defs per file is normal)', () => {
    const fooDef = { ...sym('scip:ts:src/a:foo'), absPath: '/p/a.ts', relPath: 'a.ts' }
    const barDef = { ...sym('scip:ts:src/a:bar'), absPath: '/p/a.ts', relPath: 'a.ts' }
    const result = canonicalMerge([fooDef, barDef], '/p')
    expect(result.symbols).toHaveLength(2)
  })

  it('keeps file-symbol AND its Definition symbols sharing absPath', () => {
    const file = fileSym('file::/p/a.ts', '/p/a.ts')
    const fooDef = { ...sym('scip:ts:src/a:foo'), absPath: '/p/a.ts', relPath: 'a.ts' }
    const barDef = { ...sym('scip:ts:src/a:bar'), absPath: '/p/a.ts', relPath: 'a.ts' }
    const result = canonicalMerge([file, fooDef, barDef], '/p')
    expect(result.symbols).toHaveLength(3)
    expect(result.symbols.filter(s => s.kind === 'file')).toHaveLength(1)
    expect(result.symbols.filter(s => s.kind === 'function')).toHaveLength(2)
  })

  it('throws InvariantError on irreconcilable id collision (same id, different absPath)', () => {
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

const rel = (from: string, to: string, confidence: 'inferred' | 'verified' = 'inferred') => ({
  id: `${from}->${to}`,
  from, to,
  kind: 'imports' as const,
  language: 'ts' as const,
  confidence,
})

describe('canonicalMerge — relationship rewriting', () => {
  it('rewrites loser id in relationship endpoints to winner id (file-level dedup)', () => {
    const a = fileSym('tsc:ts:src/a', '/p/a.ts')
    const b = fileSym('scip:ts:src/a', '/p/a.ts')
    const c = fileSym('tsc:ts:src/b', '/p/b.ts')
    const relationship = rel('scip:ts:src/a', 'tsc:ts:src/b')
    const result = canonicalMerge([a, b, c], '/p', [relationship])
    expect(result.relationships).toHaveLength(1)
    expect(result.relationships[0]?.from).toBe('tsc:ts:src/a')
  })

  it('drops self-loops created by file-level dedup', () => {
    const a = fileSym('tsc:ts:src/a', '/p/a.ts')
    const b = fileSym('scip:ts:src/a', '/p/a.ts')
    const selfLoopRel = rel('scip:ts:src/a', 'tsc:ts:src/a')
    const result = canonicalMerge([a, b], '/p', [selfLoopRel])
    expect(result.relationships).toHaveLength(0)
  })

  it('prefers verified relationship over inferred with same (from, to, kind) key', () => {
    const a = sym('tsc:ts:src/a:fn')
    const b = sym('tsc:ts:src/b:fn')
    const inferred = rel(a.id, b.id, 'inferred')
    const verified = rel(a.id, b.id, 'verified')
    const result = canonicalMerge([a, b], '/p', [inferred, verified])
    expect(result.relationships).toHaveLength(1)
    expect(result.relationships[0]?.confidence).toBe('verified')
  })
})
