import type { IR, CFSymbol, CFDocument, Relationship } from './types.js'

function deduplicateDocuments(docs: CFDocument[]): CFDocument[] {
  const seen = new Set<string>()
  return docs.filter(d => seen.has(d.absPath) ? false : (seen.add(d.absPath), true))
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
  return {
    schemaVersion: '1',
    meta: { ...root.meta, extractor: { name: 'merged', version: '0', invocation: 'merged' } },
    documents: deduplicateDocuments(irs.flatMap(ir => ir.documents)),
    symbols: [...symbolMap.values()],
    relationships: [...relMap.values()],
  }
}
