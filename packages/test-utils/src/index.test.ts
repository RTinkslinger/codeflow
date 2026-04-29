import { describe, it, expect, afterEach } from 'vitest'
import { loadFixture, irEqual, sortedIREqual, mockExtractorOutput, assertInvariants, snapshotIR } from './index.js'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

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

describe('sortedIREqual', () => {
  it('compares arrays of objects with id fields regardless of insertion order', () => {
    const a = { symbols: [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }] }
    const b = { symbols: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }
    expect(sortedIREqual(a, b)).toBe(true)
  })
  it('returns false when symbol content differs', () => {
    const a = { symbols: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }
    const c = { symbols: [{ id: 'a', name: 'A' }, { id: 'b', name: 'X' }] }
    expect(sortedIREqual(a, c)).toBe(false)
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
  it('throws on duplicate symbol IDs', () => {
    const sym = { id: 'dup:id', absPath: '/a.ts' }
    expect(() => assertInvariants({ symbols: [sym, sym] })).toThrow('duplicate symbol IDs')
  })
  it('throws when multiple file-symbols share the same absPath (one file → one file-node invariant)', () => {
    const ir = {
      symbols: [
        { id: 'a', absPath: '/mock/file.ts', kind: 'file' },
        { id: 'b', absPath: '/mock/file.ts', kind: 'file' },
      ],
    }
    expect(() => assertInvariants(ir)).toThrow(/duplicate absPath/)
  })

  it('does NOT throw when multiple non-file symbols share an absPath (legitimate: many defs per file)', () => {
    const ir = {
      symbols: [
        { id: 'a', absPath: '/mock/file.ts', kind: 'function' },
        { id: 'b', absPath: '/mock/file.ts', kind: 'function' },
      ],
    }
    expect(() => assertInvariants(ir)).not.toThrow()
  })
})

describe('snapshotIR', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const snapshotsDir = path.resolve(__dirname, '../../../tests/snapshots')
  const label = 'test-snapshot-ir'
  const snapshotPath = path.join(snapshotsDir, `${label}.json`)

  afterEach(() => {
    if (fs.existsSync(snapshotPath)) {
      fs.rmSync(snapshotPath)
    }
  })

  it('writes the serialised object to tests/snapshots/<label>.json', () => {
    const data = { schemaVersion: '1', symbols: [{ id: 'x' }] }
    snapshotIR(data, label)
    expect(fs.existsSync(snapshotPath)).toBe(true)
    const written = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    expect(written).toEqual(data)
  })
})
