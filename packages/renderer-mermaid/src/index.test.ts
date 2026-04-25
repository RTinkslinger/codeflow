import { describe, it, expect } from 'vitest'
import { renderMermaid } from './index.js'
import { mockExtractorOutput } from '@codeflow/test-utils'

describe('renderMermaid', () => {
  it('produces valid mermaid graph header', () => {
    const ir = mockExtractorOutput({ symbolCount: 2 })
    ir.relationships = [{ id: 'r1', from: ir.symbols[0]!.id, to: ir.symbols[1]!.id, kind: 'imports', language: 'ts', confidence: 'inferred' }]
    const out = renderMermaid(ir)
    expect(out).toMatch(/^graph (TD|LR|TB)/)
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
    expect(out).toContain('-->') // mermaid solid arrow
    expect(out).not.toContain('-.->') // not dashed
  })

  it('returns empty graph for empty IR', () => {
    const ir = mockExtractorOutput({ symbolCount: 0 })
    const out = renderMermaid(ir)
    expect(out).toMatch(/^graph/)
    expect(out.split('\n').length).toBeLessThan(5)
  })
})
