import { describe, it, expect } from 'vitest'
import { stitchCrossWorkspaceEdges } from './cross-workspace-stitch.js'
import type { IR, CFSymbol, Relationship } from '@codeflow/core'

/**
 * Unit tests for cross-workspace edge stitching.
 *
 * SCIP symbol strings are verbatim from empirical sampling of the codeflow repo
 * (2026-04-30). See the comment block in cross-workspace-stitch.ts for full context.
 *
 * Key observation:
 *   Definition side (packages/core, after canonicalMerge):
 *     file::/repo/packages/core/src/errors.ts   ← only file-symbols survive canonicalMerge
 *   Reference side (packages/cli, via pnpm symlink → dist):
 *     scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/CodeflowError#
 *
 * The stitcher maps external dist refs to the internal file-symbol by:
 *   (pkgName::moduleKey) → file-symbol id
 * where moduleKey strips the src|dist prefix and extension.
 * Both "src/errors.ts" and "dist/errors.d.ts" → moduleKey "errors".
 */

function makeIR(partial: Partial<IR>): IR {
  return {
    schemaVersion: '1',
    meta: {
      extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
      root: '/repo',
      ...partial.meta,
    },
    documents: partial.documents ?? [],
    symbols: partial.symbols ?? [],
    relationships: partial.relationships ?? [],
  }
}

// Internal file-symbols (what canonicalMerge produces — only these survive post-merge)
const CORE_FILE_ERRORS = 'file::/repo/packages/core/src/errors.ts'
const CORE_FILE_INDEX = 'file::/repo/packages/core/src/index.ts'
const CLI_FILE_DOCTOR = 'file::/repo/packages/cli/src/doctor.ts'
const CLI_FILE_MCP = 'file::/repo/packages/cli/src/mcp.ts'

// Verbatim SCIP external reference strings (from cli scanning via dist/ symlink):
const CLI_REF_CODEFLOW_ERROR = 'scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/CodeflowError#'
const CLI_REF_CREATE_ERROR = 'scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/createError().'
const CLI_REF_ERRORS_MODULE = 'scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/'
const CLI_REF_INDEX_MODULE = 'scip-typescript npm @codeflow/core 0.1.0 dist/`index.d.ts`/'

// Synthetic type-literal ref (from Zod schema expansion — maps to errors.ts by file token,
// but its moduleKey is still "errors" — it WILL stitch to the file-symbol)
const CLI_REF_TYPE_LITERAL = 'scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/CodeflowErrorSchema.`z.ZodObject`:typeLiteral15:code.'

// External ref from a package that is NOT a workspace (npm dep, not internal)
const EXTERNAL_NPM_REF = 'scip-typescript npm zod 3.22.0 dist/`types.d.ts`/ZodString#'

function makeCoreFileSym(id: string, absPath: string, relPath: string, withinWsPath: string): CFSymbol {
  return {
    id,
    kind: 'file' as const,
    name: withinWsPath.split('/').pop()!,
    absPath,
    relPath,
    language: 'ts' as const,
    origin: 'extractor' as const,
    confidence: 'verified' as const,
    workspaceRel: 'packages/core',
  }
}

describe('stitchCrossWorkspaceEdges', () => {
  it('returns unchanged IR when no workspaces are present', () => {
    const ir = makeIR({ symbols: [], relationships: [] })
    const result = stitchCrossWorkspaceEdges(ir)
    expect(result).toBe(ir)
  })

  it('returns unchanged IR when workspaces map is empty', () => {
    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: {},
      },
    })
    const result = stitchCrossWorkspaceEdges(ir)
    expect(result).toBe(ir)
  })

  it('rewrites dist/.d.ts external reference to internal file-symbol', () => {
    // Post-canonicalMerge: only file-symbols survive as internal nodes
    const coreFileSym: CFSymbol = makeCoreFileSym(
      CORE_FILE_ERRORS,
      '/repo/packages/core/src/errors.ts',
      'packages/core/src/errors.ts',
      'src/errors.ts',
    )
    const cliFileSym: CFSymbol = {
      id: CLI_FILE_DOCTOR,
      kind: 'file',
      name: 'doctor.ts',
      absPath: '/repo/packages/cli/src/doctor.ts',
      relPath: 'packages/cli/src/doctor.ts',
      language: 'ts',
      origin: 'extractor',
      confidence: 'verified',
      workspaceRel: 'packages/cli',
    }

    // External reference: CLI → Core via dist (the bug case)
    const externalRef: Relationship = {
      id: `${CLI_FILE_DOCTOR}::${CLI_REF_CODEFLOW_ERROR}::references`,
      from: CLI_FILE_DOCTOR,
      to: CLI_REF_CODEFLOW_ERROR,  // dist/`errors.d.ts`/CodeflowError#
      kind: 'references',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: {
          'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' },
          'packages/cli': { displayName: '@codeflow/cli', manifest: 'pnpm' },
        },
      },
      symbols: [coreFileSym, cliFileSym],
      relationships: [externalRef],
    })

    const result = stitchCrossWorkspaceEdges(ir)

    expect(result.relationships).toHaveLength(1)
    const stitched = result.relationships[0]!
    // Should now point at the internal file-symbol, NOT the dist SCIP ref
    expect(stitched.to).toBe(CORE_FILE_ERRORS)
    expect(stitched.from).toBe(CLI_FILE_DOCTOR)
    expect(stitched.kind).toBe('references')
  })

  it('rewrites module-level dist reference to internal file-symbol', () => {
    // CLI imports `@codeflow/core/errors` module — SCIP emits dist/`errors.d.ts`/
    const coreFileSym: CFSymbol = makeCoreFileSym(
      CORE_FILE_ERRORS,
      '/repo/packages/core/src/errors.ts',
      'packages/core/src/errors.ts',
      'src/errors.ts',
    )

    const externalRef: Relationship = {
      id: `${CLI_FILE_MCP}::${CLI_REF_ERRORS_MODULE}::imports`,
      from: CLI_FILE_MCP,
      to: CLI_REF_ERRORS_MODULE,  // dist/`errors.d.ts`/ (module-level)
      kind: 'imports',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: {
          'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' },
        },
      },
      symbols: [coreFileSym],
      relationships: [externalRef],
    })

    const result = stitchCrossWorkspaceEdges(ir)
    expect(result.relationships[0]!.to).toBe(CORE_FILE_ERRORS)
  })

  it('stitches type-literal ref whose file-token maps to an internal file-symbol', () => {
    // CLI_REF_TYPE_LITERAL has file-token "dist/`errors.d.ts`" → moduleKey "errors"
    // → maps to the file-symbol for errors.ts (file-level match; descriptor suffix is ignored)
    const coreFileSym: CFSymbol = makeCoreFileSym(
      CORE_FILE_ERRORS,
      '/repo/packages/core/src/errors.ts',
      'packages/core/src/errors.ts',
      'src/errors.ts',
    )

    const typeLiteralRef: Relationship = {
      id: `${CLI_FILE_DOCTOR}::${CLI_REF_TYPE_LITERAL}::references`,
      from: CLI_FILE_DOCTOR,
      to: CLI_REF_TYPE_LITERAL,
      kind: 'references',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: {
          'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' },
        },
      },
      symbols: [coreFileSym],
      relationships: [typeLiteralRef],
    })

    const result = stitchCrossWorkspaceEdges(ir)
    // Type-literal has file-token errors.d.ts → moduleKey "errors" → stitches to CORE_FILE_ERRORS
    expect(result.relationships[0]!.to).toBe(CORE_FILE_ERRORS)
  })

  it('leaves external npm dep references unchanged (no matching workspace)', () => {
    const coreFileSym: CFSymbol = makeCoreFileSym(
      CORE_FILE_ERRORS,
      '/repo/packages/core/src/errors.ts',
      'packages/core/src/errors.ts',
      'src/errors.ts',
    )

    const npmRef: Relationship = {
      id: `${CLI_FILE_DOCTOR}::${EXTERNAL_NPM_REF}::references`,
      from: CLI_FILE_DOCTOR,
      to: EXTERNAL_NPM_REF,  // zod — not a workspace
      kind: 'references',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: {
          'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' },
        },
      },
      symbols: [coreFileSym],
      relationships: [npmRef],
    })

    const result = stitchCrossWorkspaceEdges(ir)
    // External npm refs are left untouched
    expect(result.relationships[0]!.to).toBe(EXTERNAL_NPM_REF)
  })

  it('deduplicates after stitching — does not produce duplicate (from, to, kind) tuples', () => {
    const coreFileSym: CFSymbol = makeCoreFileSym(
      CORE_FILE_ERRORS,
      '/repo/packages/core/src/errors.ts',
      'packages/core/src/errors.ts',
      'src/errors.ts',
    )

    // rel1: dist path → will be stitched to CORE_FILE_ERRORS
    const rel1: Relationship = {
      id: 'rel1',
      from: CLI_FILE_DOCTOR,
      to: CLI_REF_CODEFLOW_ERROR,
      kind: 'references',
      language: 'ts',
      confidence: 'verified',
    }
    // rel2: already an internal file-symbol — internalSymbolIds check passes it through
    // but (from, to, kind) will collide after rel1 is stitched to CORE_FILE_ERRORS
    const rel2: Relationship = {
      id: 'rel2',
      from: CLI_FILE_DOCTOR,
      to: CORE_FILE_ERRORS,  // already stitched / already internal
      kind: 'references',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: { 'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' } },
      },
      symbols: [coreFileSym],
      relationships: [rel1, rel2],
    })

    const result = stitchCrossWorkspaceEdges(ir)
    // Both point to the same (from, to, kind) after stitching — must be deduped to 1
    expect(result.relationships).toHaveLength(1)
    expect(result.relationships[0]!.to).toBe(CORE_FILE_ERRORS)
  })

  it('stitches multiple distinct symbols in one pass', () => {
    const coreErrorsSym: CFSymbol = makeCoreFileSym(
      CORE_FILE_ERRORS,
      '/repo/packages/core/src/errors.ts',
      'packages/core/src/errors.ts',
      'src/errors.ts',
    )
    const coreIndexSym: CFSymbol = makeCoreFileSym(
      CORE_FILE_INDEX,
      '/repo/packages/core/src/index.ts',
      'packages/core/src/index.ts',
      'src/index.ts',
    )

    // Two different external refs targeting different modules
    const rel1: Relationship = {
      id: 'r1',
      from: CLI_FILE_DOCTOR,
      to: CLI_REF_CODEFLOW_ERROR,  // → errors module
      kind: 'references',
      language: 'ts',
      confidence: 'verified',
    }
    const rel2: Relationship = {
      id: 'r2',
      from: CLI_FILE_MCP,
      to: CLI_REF_INDEX_MODULE,    // → index module
      kind: 'imports',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: { 'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' } },
      },
      symbols: [coreErrorsSym, coreIndexSym],
      relationships: [rel1, rel2],
    })

    const result = stitchCrossWorkspaceEdges(ir)
    expect(result.relationships).toHaveLength(2)
    const toIds = new Set(result.relationships.map(r => r.to))
    expect(toIds.has(CORE_FILE_ERRORS)).toBe(true)
    expect(toIds.has(CORE_FILE_INDEX)).toBe(true)
  })

  it('does not rewrite internal-to-internal edges', () => {
    // Both symbols are internal file-symbols — no rewrite should happen
    const symA: CFSymbol = {
      id: CLI_FILE_MCP,
      kind: 'file',
      name: 'mcp.ts',
      absPath: '/repo/packages/cli/src/mcp.ts',
      relPath: 'packages/cli/src/mcp.ts',
      language: 'ts',
      origin: 'extractor',
      confidence: 'verified',
      workspaceRel: 'packages/cli',
    }
    const symB: CFSymbol = {
      id: 'file::/repo/packages/cli/src/state.ts',
      kind: 'file',
      name: 'state.ts',
      absPath: '/repo/packages/cli/src/state.ts',
      relPath: 'packages/cli/src/state.ts',
      language: 'ts',
      origin: 'extractor',
      confidence: 'verified',
      workspaceRel: 'packages/cli',
    }

    const rel: Relationship = {
      id: 'r1',
      from: symA.id,
      to: symB.id,
      kind: 'imports',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: {
          'packages/cli': { displayName: '@codeflow/cli', manifest: 'pnpm' },
          'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' },
        },
      },
      symbols: [symA, symB],
      relationships: [rel],
    })

    const result = stitchCrossWorkspaceEdges(ir)
    expect(result.relationships[0]!.to).toBe(symB.id)  // unchanged
  })

  it('handles ambiguous key (two file-symbols with same pkgName::moduleKey) by skipping stitch', () => {
    // Edge case: two file-symbols that produce the same (pkgName::moduleKey) key
    // (shouldn't happen in normal monorepos but must not crash)
    const sym1: CFSymbol = {
      id: 'file::/repo/packages/core/src/errors.ts',
      kind: 'file',
      name: 'errors.ts',
      absPath: '/repo/packages/core/src/errors.ts',
      relPath: 'packages/core/src/errors.ts',
      language: 'ts',
      origin: 'extractor',
      confidence: 'verified',
      workspaceRel: 'packages/core',
    }
    const sym2: CFSymbol = {
      id: 'file::/repo/packages/core/dist/errors.ts',
      kind: 'file',
      name: 'errors.ts',
      absPath: '/repo/packages/core/dist/errors.ts',
      relPath: 'packages/core/dist/errors.ts',
      language: 'ts',
      origin: 'extractor',
      confidence: 'verified',
      workspaceRel: 'packages/core',
    }

    const externalRef: Relationship = {
      id: 'r1',
      from: CLI_FILE_DOCTOR,
      to: CLI_REF_CODEFLOW_ERROR,
      kind: 'references',
      language: 'ts',
      confidence: 'verified',
    }

    const ir = makeIR({
      meta: {
        extractor: { name: 'test', version: '0.0.0', invocation: 'test' },
        root: '/repo',
        workspaces: { 'packages/core': { displayName: '@codeflow/core', manifest: 'pnpm' } },
      },
      symbols: [sym1, sym2],
      relationships: [externalRef],
    })

    const result = stitchCrossWorkspaceEdges(ir)
    // Ambiguous key — stitcher skips, ref remains unstitched
    expect(result.relationships[0]!.to).toBe(CLI_REF_CODEFLOW_ERROR)
  })
})
