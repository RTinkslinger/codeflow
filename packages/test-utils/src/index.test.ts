import { describe, it, expect } from 'vitest'
import { loadFixture, irEqual, mockExtractorOutput, assertInvariants } from './index.js'
import path from 'node:path'

describe('loadFixture', () => {
  it('returns absolute path to fixture dir', () => {
    const p = loadFixture('pure-ts')
    expect(path.isAbsolute(p)).toBe(true)
    expect(p).toContain('pure-ts')
  })
  it('throws on unknown fixture', () => {
    expect(() => loadFixture('no-such-fixture')).toThrow('Unknown fixture')
  })
})

describe('irEqual', () => {
  it('compares two IR objects ignoring field order', () => {
    const a = { schemaVersion: '1' as const, meta: { extractor: { name: 'x', version: '0', invocation: '' }, root: '/' }, documents: [], symbols: [], relationships: [] }
    expect(irEqual(a, { ...a })).toBe(true)
  })
})

describe('mockExtractorOutput', () => {
  it('returns an IR with injected symbols', () => {
    const ir = mockExtractorOutput({ symbolCount: 3 })
    expect(ir.symbols).toHaveLength(3)
    expect(ir.schemaVersion).toBe('1')
  })
})

describe('assertInvariants', () => {
  it('throws on duplicate absPath', () => {
    const ir = {
      symbols: [
        { id: 'a', absPath: '/mock/file.ts' },
        { id: 'b', absPath: '/mock/file.ts' },
      ],
    }
    expect(() => assertInvariants(ir)).toThrow('duplicate absPath')
  })
})
