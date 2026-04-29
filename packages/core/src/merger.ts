import type { IR, CFSymbol, CFDocument, Relationship } from './types.js'

function deduplicateDocuments(docs: CFDocument[]): CFDocument[] {
  const seen = new Set<string>()
  return docs.filter(d => seen.has(d.absPath) ? false : (seen.add(d.absPath), true))
}

function mergeWorkspaceMaps(irs: IR[]): IR['meta']['workspaces'] {
  const out: Record<string, { displayName: string; manifest: 'pnpm' | 'pkgjson' | 'pyproject' | 'setup.py' | 'fs-fallback' }> = {}
  for (const ir of irs) {
    if (ir.meta.workspaces) Object.assign(out, ir.meta.workspaces)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function mergeIRs(irs: IR[]): IR {
  if (irs.length === 0) {
    return { schemaVersion: '1', meta: { extractor: { name: 'merged', version: '0', invocation: '' }, root: '' }, documents: [], symbols: [], relationships: [] }
  }

  const symbolMap = new Map<string, CFSymbol>()
  const relMap = new Map<string, Relationship>()

  for (const ir of irs) {
    for (const sym of ir.symbols) {
      const existing = symbolMap.get(sym.id)
      if (!existing) {
        symbolMap.set(sym.id, sym)
      } else if (sym.confidence === 'verified' && existing.confidence === 'inferred') {
        symbolMap.set(sym.id, { ...existing, ...sym, confidence: 'verified' })
      }
    }
    for (const rel of ir.relationships) {
      const key = `${rel.from}::${rel.to}::${rel.kind}`
      const existing = relMap.get(key)
      if (!existing || (rel.confidence === 'verified' && existing.confidence === 'inferred')) {
        relMap.set(key, rel)
      }
    }
  }

  const root = irs[0]!
  const isPartial = irs.some(ir => ir.meta.partial === true)
  const workspaces = mergeWorkspaceMaps(irs)
  const baseMeta = { ...root.meta }
  delete baseMeta.partial
  delete baseMeta.workspaces
  return {
    schemaVersion: '1',
    meta: {
      ...baseMeta,
      extractor: { name: 'merged', version: '0', invocation: 'merged' },
      ...(isPartial ? { partial: true } : {}),
      ...(workspaces ? { workspaces } : {}),
    },
    documents: deduplicateDocuments(irs.flatMap(ir => ir.documents)),
    symbols: [...symbolMap.values()],
    relationships: [...relMap.values()],
  }
}

export interface MergeDiff {
  added: Relationship[]
  removed: Relationship[]
  upgraded: Relationship[]
}

export function computeDiff(previous: IR | null, current: IR): MergeDiff {
  if (!previous) return { added: current.relationships, removed: [], upgraded: [] }

  const prevByKey = new Map(previous.relationships.map(r => [`${r.from}::${r.to}::${r.kind}`, r]))
  const currByKey = new Map(current.relationships.map(r => [`${r.from}::${r.to}::${r.kind}`, r]))

  const added: Relationship[] = []
  const removed: Relationship[] = []
  const upgraded: Relationship[] = []

  for (const [key, rel] of currByKey) {
    const prev = prevByKey.get(key)
    if (!prev) { added.push(rel) }
    else if (prev.confidence === 'inferred' && rel.confidence === 'verified') { upgraded.push(rel) }
  }
  for (const [key, rel] of prevByKey) {
    if (!currByKey.has(key)) removed.push(rel)
  }
  return { added, removed, upgraded }
}
