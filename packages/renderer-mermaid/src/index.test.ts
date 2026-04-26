import { describe, it, expect } from 'vitest'
import { renderMermaid } from './index.js'
import { mockExtractorOutput } from '@codeflow/test-utils'

describe('renderMermaid', () => {
  it('defaults to LR direction', () => {
    const ir = mockExtractorOutput({ symbolCount: 1 })
    const out = renderMermaid(ir)
    expect(out).toMatch(/^graph LR/)
  })

  it('produces valid mermaid graph header', () => {
    const ir = mockExtractorOutput({ symbolCount: 2 })
    ir.relationships = [{ id: 'r1', from: ir.symbols[0]!.id, to: ir.symbols[1]!.id, kind: 'imports', language: 'ts', confidence: 'inferred' }]
    const out = renderMermaid(ir, 'TD')
    expect(out).toMatch(/^graph TD/)
  })

  it('renders inferred edges as dashed', () => {
    const ir = mockExtractorOutput({ symbolCount: 2 })
    ir.relationships = [{ id: 'r1', from: ir.symbols[0]!.id, to: ir.symbols[1]!.id, kind: 'imports', language: 'ts', confidence: 'inferred' }]
    const out = renderMermaid(ir)
    expect(out).toContain('-.->') // mermaid dashed arrow
  })

  it('renders verified edges as solid', () => {
    const ir = mockExtractorOutput({ symbolCount: 2 })
    ir.relationships = [{ id: 'r1', from: ir.symbols[0]!.id, to: ir.symbols[1]!.id, kind: 'imports', language: 'ts', confidence: 'verified' }]
    const out = renderMermaid(ir)
    expect(out).toContain('-->')
    expect(out).not.toContain('-.->') // not dashed
  })

  it('returns empty graph for empty IR', () => {
    const ir = mockExtractorOutput({ symbolCount: 0 })
    const out = renderMermaid(ir)
    expect(out).toMatch(/^graph/)
    expect(out.split('\n').length).toBeLessThan(5)
  })

  it('sanitizes double-quotes in node labels', () => {
    const ir = mockExtractorOutput({ symbolCount: 1 })
    ir.symbols[0]!.name = 'AuthService["admin"]'
    const out = renderMermaid(ir)
    expect(out).not.toContain('"AuthService["')
    expect(out).toContain('&quot;')
  })

  it('sanitizes double-quotes in edge labels', () => {
    const ir = mockExtractorOutput({ symbolCount: 2 })
    ir.relationships = [{
      id: 'r1', from: ir.symbols[0]!.id, to: ir.symbols[1]!.id,
      kind: 'imports', language: 'ts', confidence: 'inferred',
      viz: { label: 'foo" | "bar' },
    }]
    const out = renderMermaid(ir)
    expect(out).not.toMatch(/\|"foo" \|/)
    expect(out).toContain('&quot;')
  })

  it('disambiguates safeId collisions from truncation', () => {
    const ir = mockExtractorOutput({ symbolCount: 0 })
    // Two IDs that share the same 60-char prefix after sanitization
    const prefix = 'a'.repeat(60)
    ir.symbols = [
      { id: `${prefix}X`, kind: 'module', name: 'A', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' },
      { id: `${prefix}Y`, kind: 'module', name: 'B', absPath: '/p/b.ts', relPath: 'b.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' },
    ]
    const out = renderMermaid(ir)
    const nodeLines = out.split('\n').filter(l => l.includes('["'))
    // Each symbol must produce a unique node ID
    const ids = nodeLines.map(l => l.trim().split('[')[0]!.trim())
    expect(new Set(ids).size).toBe(2)
  })
})
