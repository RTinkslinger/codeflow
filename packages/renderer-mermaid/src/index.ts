import type { IR, CFSymbol } from '@codeflow/core'

const SAFE_ID_RE = /[^a-zA-Z0-9_]/g

function safeId(id: string): string {
  return id.replace(SAFE_ID_RE, '_').slice(0, 60)
}

function nodeLabel(sym: CFSymbol): string {
  return sym.viz?.label ?? sym.name
}

export function renderMermaid(ir: IR, direction: 'TD' | 'LR' = 'LR'): string {
  const lines: string[] = [`graph ${direction}`]

  // Group nodes by language for subgraph separation
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
    const label = rel.viz?.label ? `|"${rel.viz.label}"|` : ''
    lines.push(`  ${fromSafe} ${arrow}${label} ${toSafe}`)
  }

  return lines.join('\n')
}
