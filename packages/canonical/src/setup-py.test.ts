import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { extractSetupPyName } from './extract-setup-py-name.js'
import { detectWorkspaces } from './detect-workspaces.js'
import { _resetMemoCache } from './detect-workspaces.js'

describe('extractSetupPyName', () => {
  it('extracts from name="..."', () => {
    const r = extractSetupPyName(`from setuptools import setup\nsetup(name="my-pkg", version="1.0")`)
    expect(r.name).toBe('my-pkg')
    expect(r.warning).toBeUndefined()
  })
  it("extracts from name='...'", () => {
    const r = extractSetupPyName(`setup(name='my-pkg')`)
    expect(r.name).toBe('my-pkg')
  })
  it('returns warning when name is a variable', () => {
    const r = extractSetupPyName(`PKG = "x"\nsetup(name=PKG)`)
    expect(r.name).toBeNull()
    expect(r.warning).toBe('SETUP_PY_NAME_UNRESOLVED')
  })
  it('returns warning when name is computed', () => {
    const r = extractSetupPyName(`setup(name=open('VERSION').read())`)
    expect(r.warning).toBe('SETUP_PY_NAME_UNRESOLVED')
  })
  it('returns warning when name is missing', () => {
    const r = extractSetupPyName(`setup(version="1.0")`)
    expect(r.warning).toBe('SETUP_PY_NAME_UNRESOLVED')
  })
  it('does not match suffix identifiers like author_name=', () => {
    const r = extractSetupPyName(`setup(author_name='John Doe', version='1.0')`)
    expect(r.name).toBeNull()
    expect(r.warning).toBe('SETUP_PY_NAME_UNRESOLVED')
  })
})

describe('detectWorkspaces — setup.py', () => {
  it('detects setup.py-only workspace', async () => {
    _resetMemoCache()
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-setup-only')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(1)
    const w = ws[0]
    expect(w).toBeDefined()
    expect(w?.manifest).toBe('setup.py')
    expect(w?.displayName).toBe('legacy-pkg')
  })

  it('pyproject wins over setup.py in same dir', async () => {
    _resetMemoCache()
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-both')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(1)
    const w = ws[0]
    expect(w).toBeDefined()
    expect(w?.manifest).toBe('pyproject')
  })
})
