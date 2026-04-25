import type { IR, CFSymbol } from '@codeflow/core'

const SAFE_ID_RE = /[^a-zA-Z0-9_]/g

function sanitizeLabel(label: string): string {
  return label.replace(/"/g, '&quot;').replace(/]/g, '&#93;')
}

function buildSafeIdMap(ir: IR): (id: string) => string {
  const idToSafe = new Map<string, string>()
  const taken = new Set<string>()

  const allIds = [
    ...ir.symbols.map(s => s.id),
    ...ir.relationships.flatMap(r => [r.from, r.to]),
  ]

  for (const id of allIds) {
    if (idToSafe.has(id)) continue
    const base = id.replace(SAFE_ID_RE, '_').slice(0, 60)
    if (!taken.has(base)) {
      idToSafe.set(id, base)
      taken.add(base)
    } else {
      let i = 1
      while (taken.has(`${base}_${i}`)) i++
      const safe = `${base}_${i}`
      idToSafe.set(id, safe)
      taken.add(safe)
    }
  }

  return (id: string) => idToSafe.get(id) ?? id.replace(SAFE_ID_RE, '_').slice(0, 60)
}

function nodeLabel(sym: CFSymbol): string {
  return sanitizeLabel(sym.viz?.label ?? sym.name)
}

export function renderMermaid(ir: IR, direction: 'TD' | 'LR' = 'LR'): string {
  const lines: string[] = [`graph ${direction}`]
  const safeId = buildSafeIdMap(ir)

  const byLang = new Map<string, CFSymbol[]>()
  for (const sym of ir.symbols) {
    const group = byLang.get(sym.language) ?? []
    group.push(sym)
    byLang.set(sym.language, group)
  }

  if (byLang.size > 1) {
    for (const [lang, syms] of byLang) {
      lines.push(`  subgraph ${lang}`)
      for (const sym of syms) {
        lines.push(`    ${safeId(sym.id)}["${nodeLabel(sym)}"]`)
      }
      lines.push(`  end`)
    }
  } else {
    for (const sym of ir.symbols) {
      lines.push(`  ${safeId(sym.id)}["${nodeLabel(sym)}"]`)
    }
  }

  for (const rel of ir.relationships) {
    const fromSafe = safeId(rel.from)
    const toSafe = safeId(rel.to)
    const arrow = rel.confidence === 'verified' ? '-->' : '-.->'
    const label = rel.viz?.label ? `|"${sanitizeLabel(rel.viz.label)}"|` : ''
    lines.push(`  ${fromSafe} ${arrow}${label} ${toSafe}`)
  }

  return lines.join('\n')
}
