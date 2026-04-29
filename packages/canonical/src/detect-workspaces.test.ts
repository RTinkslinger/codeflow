import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { detectWorkspaces } from './detect-workspaces.js'

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
