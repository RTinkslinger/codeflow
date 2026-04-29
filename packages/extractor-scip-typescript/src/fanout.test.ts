import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipTypescriptExtractor } from './index.js'

const FIXTURE = path.resolve(__dirname, '../../test-utils/fixtures/monorepo-3pkg-ts')

describe('scip-typescript fan-out', () => {
  it('extracts from leaf workspaces, partial:true on broken tsconfig', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE, root: FIXTURE })

    // pkg-a + pkg-b succeed
    expect(result.ir.symbols.some(s => s.workspaceRel === 'packages/pkg-a')).toBe(true)
    expect(result.ir.symbols.some(s => s.workspaceRel === 'packages/pkg-b')).toBe(true)

    // partial set due to pkg-c failure
    expect(result.ir.meta.partial).toBe(true)

    // workspaceErrors populated for pkg-c
    expect(result.workspaceErrors).toBeDefined()
    expect(result.workspaceErrors!.length).toBeGreaterThan(0)
    const cErr = result.workspaceErrors!.find(e => (e.workspace as any).workspaceRel === 'packages/pkg-c')
    expect(cErr).toBeDefined()

    // workspaces meta populated
    expect(result.ir.meta.workspaces).toBeDefined()
    expect(Object.keys(result.ir.meta.workspaces!)).toContain('packages/pkg-a')
    expect(Object.keys(result.ir.meta.workspaces!)).toContain('packages/pkg-b')
  }, 180_000)
})
