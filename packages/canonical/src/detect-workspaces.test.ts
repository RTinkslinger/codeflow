import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import { detectWorkspaces, _resetMemoCache } from './detect-workspaces.js'

describe('detectWorkspaces — TS', () => {
  it('reads pnpm-workspace.yaml', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const ws = await detectWorkspaces(root, 'ts')
    expect(ws.length).toBe(3)
    expect(ws.map(w => w.workspaceRel).sort()).toEqual(['packages/alpha', 'packages/beta', 'packages/gamma'])
    expect(ws.every(w => w.manifest === 'pnpm')).toBe(true)
    expect(ws.every(w => w.language === 'ts')).toBe(true)
  })

  it('reads package.json#workspaces', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pkgjson')
    const ws = await detectWorkspaces(root, 'ts')
    expect(ws.length).toBe(2)
    expect(ws.every(w => w.manifest === 'pkgjson')).toBe(true)
  })

  it('uses package.json `name` for displayName', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const ws = await detectWorkspaces(root, 'ts')
    const alpha = ws.find(w => w.workspaceRel === 'packages/alpha')!
    expect(alpha.displayName).toBe('alpha')
  })

  it('falls back to single-path when no manifest found', async () => {
    const tmp = path.resolve(__dirname, '../tests/fixtures/ws-empty')
    const ws = await detectWorkspaces(tmp, 'ts')
    expect(ws.length).toBe(1)
    expect(ws[0]!.manifest).toBe('fs-fallback')
  })

  it('falls back to filesystem walk when no manifest', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-fswalk')
    const ws = await detectWorkspaces(root, 'ts')
    expect(ws.length).toBe(3)   // apps/web, apps/api, libs/shared
    expect(ws.every(w => w.manifest === 'fs-fallback')).toBe(true)
    // Must NOT include node_modules entries
    expect(ws.every(w => !w.workspaceRel.includes('node_modules'))).toBe(true)
  })

  it('computes isLeaf via tsconfig references graph', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-references')
    const ws = await detectWorkspaces(root, 'ts')
    const shared = ws.find(w => w.workspaceRel === 'packages/shared')!
    const web = ws.find(w => w.workspaceRel === 'packages/web')!
    // shared is REFERENCED BY web → not a leaf
    expect(shared.isLeaf).toBe(false)
    // web references shared but nothing references web → leaf
    expect(web.isLeaf).toBe(true)
  }, 30_000)
})

describe('detectWorkspaces — Py', () => {
  it('reads [tool.uv.workspace] members', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-uv')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(2)
    expect(ws.every(w => w.manifest === 'pyproject')).toBe(true)
    expect(ws.every(w => w.language === 'py')).toBe(true)
    expect(ws.every(w => w.isLeaf === true)).toBe(true)   // Py has no tsconfig references
    expect(ws.map(w => w.workspaceRel).sort()).toEqual(['packages/alpha', 'packages/beta'])
  })

  it('treats single pyproject.toml as one workspace', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-flat')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(1)
    expect(ws[0]!.manifest).toBe('pyproject')
    expect(ws[0]!.displayName).toBe('single-pkg')
  })

  it('fs-walk fallback finds nested pyproject.toml', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-fswalk')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(2)
    expect(ws.every(w => w.manifest === 'fs-fallback')).toBe(true)
  })

  it('extracts displayName from [project].name', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-uv')
    const ws = await detectWorkspaces(root, 'py')
    const alpha = ws.find(w => w.workspaceRel === 'packages/alpha')!
    expect(alpha.displayName).toBe('alpha')
  })
})

describe('detectWorkspaces memoization', () => {
  it('returns cached result on repeat call without manifest mtime change', async () => {
    _resetMemoCache()
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const a = await detectWorkspaces(root, 'ts')
    const b = await detectWorkspaces(root, 'ts')
    // Same array reference indicates the cached value was returned
    expect(b).toBe(a)
  })

  it('invalidates when manifest mtime changes', async () => {
    _resetMemoCache()
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const a = await detectWorkspaces(root, 'ts')
    const yml = path.join(root, 'pnpm-workspace.yaml')
    const stat = await fs.stat(yml)
    await fs.utimes(yml, stat.atime, new Date(Date.now() + 1000))
    const b = await detectWorkspaces(root, 'ts')
    try {
      expect(b).not.toBe(a)   // recomputed → different array reference
    } finally {
      // Restore mtime even if the assertion fails so other tests aren't affected
      await fs.utimes(yml, stat.atime, stat.mtime)
      _resetMemoCache()
    }
  })

  it('separate cache per language', async () => {
    _resetMemoCache()
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const ts1 = await detectWorkspaces(root, 'ts')
    const py1 = await detectWorkspaces(root, 'py')   // different cache key
    const ts2 = await detectWorkspaces(root, 'ts')
    expect(ts2).toBe(ts1)
    expect(py1).not.toBe(ts1)   // different language → different result
  })
})
