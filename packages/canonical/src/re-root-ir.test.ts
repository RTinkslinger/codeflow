import { describe, it, expect } from 'vitest'
import { reRootIR } from './re-root-ir.js'
import type { IR } from '@codeflow/core'

const wsRoot = '/r/packages/cli'
const repoRoot = '/r'

const inputIR: IR = {
  schemaVersion: '1',
  meta: { extractor: { name: 'scip-ts', version: 'x', invocation: 'cli' }, root: wsRoot },
  documents: [
    { relPath: 'src/index.ts', absPath: '/r/packages/cli/src/index.ts', language: 'ts' },
  ],
  symbols: [
    {
      id: 'file::/r/packages/cli/src/index.ts',
      kind: 'file',
      name: 'index.ts',
      absPath: '/r/packages/cli/src/index.ts',
      relPath: 'src/index.ts',
      language: 'ts',
      origin: 'extractor',
      confidence: 'verified',
    },
    {
      id: 'sym1',
      kind: 'function',
      name: 'foo',
      absPath: '/r/packages/cli/src/index.ts',
      relPath: 'src/index.ts',
      language: 'ts',
      origin: 'extractor',
      confidence: 'verified',
    },
  ],
  relationships: [
    {
      id: 'rel1',
      from: 'file::/r/packages/cli/src/index.ts',
      to: 'sym1',
      kind: 'imports',
      language: 'ts',
      confidence: 'verified',
    },
  ],
}

describe('reRootIR', () => {
  it('rewrites meta.root to repoRoot', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    expect(out.meta.root).toBe(repoRoot)
  })

  it('rewrites every doc relPath to be repo-relative', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    expect(out.documents[0]!.relPath).toBe('packages/cli/src/index.ts')
    expect(out.documents[0]!.absPath).toBe('/r/packages/cli/src/index.ts')
  })

  it('rewrites every symbol relPath to be repo-relative', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    for (const s of out.symbols) {
      expect(s.relPath).toBe('packages/cli/src/index.ts')
    }
  })

  it('stamps workspaceRel on every symbol', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    for (const s of out.symbols) {
      expect(s.workspaceRel).toBe('packages/cli')
    }
  })

  it('preserves Relationship structure (no source field expected in M1 IRs)', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    expect(out.relationships[0]!.from).toBe('file::/r/packages/cli/src/index.ts')
    expect(out.relationships[0]!.to).toBe('sym1')
  })

  it('throws if Relationship.source.file is not a file-symbol id (PR1 contract violation)', () => {
    const bad: IR = {
      ...inputIR,
      relationships: [{
        id: 'r2',
        from: 'file::/r/packages/cli/src/index.ts',
        to: 'sym1',
        kind: 'references',
        language: 'ts',
        confidence: 'verified',
        source: { file: '/some/raw/path.ts', line: 1 },
      }],
    }
    expect(() => reRootIR(bad, repoRoot, 'packages/cli')).toThrow(/file-symbol id/)
  })

  it('idempotent: applying twice gives same result', () => {
    const a = reRootIR(inputIR, repoRoot, 'packages/cli')
    const b = reRootIR(a, repoRoot, 'packages/cli')
    expect(b).toEqual(a)
  })

  it('property: posixRelative(newRoot, symbol.absPath) === symbol.relPath for all symbols', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    for (const s of out.symbols) {
      const expected = s.absPath.startsWith(repoRoot + '/') ? s.absPath.slice(repoRoot.length + 1) : s.absPath
      expect(s.relPath).toBe(expected)
    }
  })
})
