import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

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

export function irEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))
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

type MockOptions = { symbolCount?: number; language?: string }

export function mockExtractorOutput(opts: MockOptions = {}) {
  const { symbolCount = 1, language = 'ts' } = opts
  return {
    schemaVersion: '1' as const,
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
  const __dirnameSnap = path.dirname(fileURLToPath(import.meta.url))
  const dir = path.resolve(__dirnameSnap, '../../../tests/snapshots')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(ir, null, 2))
}

export function assertInvariants(ir: { symbols: Array<{ id: string; absPath: string }> }): void {
  const ids = ir.symbols.map(s => s.id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    throw new Error(`IR invariant violated: duplicate symbol IDs found`)
  }
  const paths = ir.symbols.map(s => s.absPath)
  const uniquePaths = new Set(paths)
  if (paths.length !== uniquePaths.size) {
    throw new Error(`IR invariant violated: duplicate absPath found — canonicalMerge was not called`)
  }
}
