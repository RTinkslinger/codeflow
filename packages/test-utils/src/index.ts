import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { IR, Language } from '@codeflow/core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_ROOT = path.resolve(__dirname, '../../../tests/fixtures')

const KNOWN_FIXTURES = [
  'pure-ts', 'pure-py-typed', 'pure-py-dynamic',
  'mixed-ts-py', 'ts-codegen-py', 'monorepo',
] as const

export function loadFixture(name: string): string {
  if (!(KNOWN_FIXTURES as readonly string[]).includes(name)) {
    throw new Error(`Unknown fixture: "${name}". Known: ${KNOWN_FIXTURES.join(', ')}`)
  }
  return path.join(FIXTURES_ROOT, name)
}

/**
 * Deep structural equality ignoring object key order.
 * Arrays are compared in insertion order — use `sortedIREqual` if extractor output order is unstable.
 */
export function irEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))
}

export function sortedIREqual(a: unknown, b: unknown): boolean {
  return irEqual(sortArrays(a), sortArrays(b))
}

function sortArrays(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    const sorted = obj.map(sortArrays)
    if (sorted.length > 0 && typeof sorted[0] === 'object' && sorted[0] !== null && 'id' in (sorted[0] as object)) {
      return (sorted as Array<{ id: string }>).sort((a, b) => a.id.localeCompare(b.id))
    }
    return sorted
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sortArrays(v)])
    )
  }
  return obj
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)])
    )
  }
  return obj
}

type MockOptions = { symbolCount?: number; language?: Language }

export function mockExtractorOutput(opts: MockOptions = {}): IR {
  const { symbolCount = 1, language = 'ts' } = opts
  return {
    schemaVersion: '1',
    meta: {
      extractor: { name: 'mock', version: '0.0.0', invocation: 'mock' },
      root: '/mock',
    },
    documents: [],
    symbols: Array.from({ length: symbolCount }, (_, i) => ({
      id: `mock:mock:mock/file-${i}:sym${i}`,
      kind: 'function' as const,
      name: `sym${i}`,
      absPath: `/mock/file-${i}.ts`,
      relPath: `file-${i}.ts`,
      language,
      origin: 'extractor' as const,
      confidence: 'inferred' as const,
    })),
    relationships: [],
  }
}

export function snapshotIR(ir: unknown, label: string): void {
  if (!/^[\w-]+$/.test(label)) throw new Error(`snapshotIR: label must be alphanumeric/hyphens, got: ${label}`)
  const dir = path.resolve(__dirname, '../../../tests/snapshots')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(ir, null, 2))
}

export function assertInvariants(ir: { symbols: Array<{ id: string; absPath: string; kind?: string }> }): void {
  const ids = ir.symbols.map(s => s.id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    throw new Error(`IR invariant violated: duplicate symbol IDs found`)
  }
  // The "one file on disk → one node" invariant applies to FILE-level symbols only.
  // Function/class/method symbols can legitimately share an absPath (multiple defs in one file).
  const fileSymbols = ir.symbols.filter(s => s.kind === 'file')
  const filePaths = fileSymbols.map(s => s.absPath)
  const uniqueFilePaths = new Set(filePaths)
  if (filePaths.length !== uniqueFilePaths.size) {
    throw new Error(`IR invariant violated: duplicate absPath values found among file-symbols — one file on disk must produce exactly one file-node`)
  }
}
