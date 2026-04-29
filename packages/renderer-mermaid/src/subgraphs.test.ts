import { describe, it, expect } from 'vitest'
import { renderMermaid } from './index.js'
import type { IR } from '@codeflow/core'

const irWithWorkspaces: IR = {
  schemaVersion: '1',
  meta: {
    extractor: { name: 'scip-ts', version: 'x', invocation: '' },
    root: '/r',
    workspaces: {
      'packages/cli': { displayName: 'cli', manifest: 'pnpm' },
      'packages/core': { displayName: 'core', manifest: 'pnpm' },
    },
  },
  documents: [],
  symbols: [
    { id: 's1', kind: 'function', name: 'foo', absPath: '/r/packages/cli/foo.ts', relPath: 'packages/cli/foo.ts', language: 'ts', origin: 'extractor', confidence: 'verified', workspaceRel: 'packages/cli' },
    { id: 's2', kind: 'function', name: 'bar', absPath: '/r/packages/core/bar.ts', relPath: 'packages/core/bar.ts', language: 'ts', origin: 'extractor', confidence: 'verified', workspaceRel: 'packages/core' },
  ],
  relationships: [
    { id: 'r1', from: 's1', to: 's2', kind: 'imports', language: 'ts', confidence: 'verified' },
  ],
}

describe('renderMermaid subgraphs', () => {
  it('emits one subgraph per workspaceRel with displayName label', () => {
    const out = renderMermaid(irWithWorkspaces)
    expect(out).toMatch(/subgraph ws_packages_cli\["cli"\]/)
    expect(out).toMatch(/subgraph ws_packages_core\["core"\]/)
    expect(out).toMatch(/end\s*\n[\s\S]*end/)
  })

  it('renders cross-subgraph edges', () => {
    const out = renderMermaid(irWithWorkspaces)
    expect(out).toMatch(/s1\s*-->\s*s2/)
  })

  it('symbols without workspaceRel render at root (no subgraph)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { workspaceRel: _dropped, ...symWithoutWs } = irWithWorkspaces.symbols[0]!
    const ir: IR = { ...irWithWorkspaces, symbols: [symWithoutWs], relationships: [] }
    const out = renderMermaid(ir)
    expect(out).not.toMatch(/subgraph ws_/)
  })
})
