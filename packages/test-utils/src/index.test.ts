import { describe, it, expect, afterEach } from 'vitest'
import { loadFixture, irEqual, mockExtractorOutput, assertInvariants, snapshotIR } from './index.js'
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
  it('throws on duplicate symbol IDs', () => {
    const sym = { id: 'dup:id', absPath: '/a.ts' }
    expect(() => assertInvariants({ symbols: [sym, sym] })).toThrow('duplicate symbol IDs')
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
