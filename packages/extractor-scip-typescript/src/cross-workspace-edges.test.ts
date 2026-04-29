import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipTypescriptExtractor } from './index.js'
import { canonicalMerge } from '@codeflow/canonical'

const FIXTURE = path.resolve(__dirname, '../../test-utils/fixtures/monorepo-3pkg-ts')

describe('cross-workspace edges', () => {
  it('produces a single canonical edge from pkg-b to pkg-a', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE, root: FIXTURE })

    const merged = canonicalMerge(result.ir.symbols, FIXTURE, result.ir.relationships)

    // Find file-symbol for pkg-b/src/index.ts
    const pkgBFile = merged.symbols.find(
      s => s.kind === 'file' && s.workspaceRel === 'packages/pkg-b' && s.relPath.endsWith('src/index.ts'),
    )
    expect(pkgBFile, 'pkg-b file-symbol not found in merged IR').toBeDefined()

    // pkg-b/src/index.ts has at least one outgoing relationship
    const outgoing = merged.relationships.filter(r => r.from === pkgBFile!.id)
    expect(outgoing.length, 'pkg-b file should have outgoing relationships').toBeGreaterThan(0)

    // At least one of those targets a pkg-a Definition symbol
    const pkgASymIds = new Set(merged.symbols.filter(s => s.workspaceRel === 'packages/pkg-a').map(s => s.id))
    const crossEdges = outgoing.filter(r => pkgASymIds.has(r.to))
    expect(crossEdges.length, 'no cross-workspace edges to pkg-a found').toBeGreaterThan(0)

    // Single canonical edge per (from, to, kind) — no duplicates after merge
    const edgeKey = (r: { from: string; to: string; kind: string }): string => `${r.from}::${r.to}::${r.kind}`
    const seen = new Set<string>()
    for (const r of merged.relationships) {
      const k = edgeKey(r)
      expect(seen.has(k), `duplicate edge after merge: ${k}`).toBe(false)
      seen.add(k)
    }
  }, 180_000)
})
