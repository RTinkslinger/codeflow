import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { canonicalizePath, posixRelative } from './canonicalizer.js'
import path from 'node:path'
import os from 'node:os'

describe('canonicalizePath', () => {
  it('resolves symlinks and returns real absolute POSIX path', () => {
    const p = canonicalizePath('/usr/local/../local/bin')
    expect(path.isAbsolute(p)).toBe(true)
    expect(p).not.toContain('..')
  })

  it('is idempotent', () => {
    fc.assert(fc.property(
      fc.constantFrom(os.homedir(), '/tmp', '/usr'),
      (p) => {
        const once = canonicalizePath(p)
        const twice = canonicalizePath(once)
        expect(once).toBe(twice)
      }
    ))
  })
})

describe('posixRelative', () => {
  it('produces POSIX-normalized relative path', () => {
    const rel = posixRelative('/project', '/project/src/auth.ts')
    expect(rel).toBe('src/auth.ts')
    expect(rel).not.toContain('\\')
  })

  it('throws when absPath is not under root', () => {
    expect(() => posixRelative('/project', '/other/file.ts')).toThrow()
  })

  it('returns empty string when absPath equals root', () => {
    expect(posixRelative('/tmp', '/tmp')).toBe('')
  })
})
