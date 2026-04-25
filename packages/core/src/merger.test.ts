import { describe, it, expect } from 'vitest'
import { mergeIRs } from './merger.js'

const BASE_META = { extractor: { name: 'test', version: '1', invocation: '' }, root: '/project' }

describe('mergeIRs', () => {
  it('merges two IRs — combines symbols, deduplicates by id', () => {
    const a = { schemaVersion: '1' as const, meta: BASE_META, documents: [], symbols: [{ id: 'sym:a', kind: 'function' as const, name: 'a', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }], relationships: [] }
    const b = { schemaVersion: '1' as const, meta: BASE_META, documents: [], symbols: [{ id: 'sym:a', kind: 'function' as const, name: 'a', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }, { id: 'sym:b', kind: 'function' as const, name: 'b', absPath: '/p/b.ts', relPath: 'b.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }], relationships: [] }
    const merged = mergeIRs([a, b])
    expect(merged.symbols).toHaveLength(2) // deduped
  })

  it('promotes inferred→verified when same id appears in both', () => {
    const inferred = { schemaVersion: '1' as const, meta: BASE_META, documents: [], symbols: [{ id: 'sym:x', kind: 'function' as const, name: 'x', absPath: '/p/x.ts', relPath: 'x.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'inferred' as const }], relationships: [] }
    const verified = { schemaVersion: '1' as const, meta: BASE_META, documents: [], symbols: [{ id: 'sym:x', kind: 'function' as const, name: 'x', absPath: '/p/x.ts', relPath: 'x.ts', language: 'ts' as const, origin: 'extractor' as const, confidence: 'verified' as const }], relationships: [] }
    const merged = mergeIRs([inferred, verified])
    expect(merged.symbols[0]?.confidence).toBe('verified')
  })

  it('returns empty IR for empty input', () => {
    const merged = mergeIRs([])
    expect(merged.symbols).toHaveLength(0)
    expect(merged.relationships).toHaveLength(0)
  })
})
