import type { IR, CFSymbol, CFDocument } from '@codeflow/core'
import { canonicalizePath, posixRelative } from './canonicalizer.js'

/**
 * Rewrite every path-derived field in `ir` from per-workspace to repo-root context,
 * and stamp `workspaceRel` on every symbol.
 *
 * Path-derived fields (per spec §3 IR shape, eng-lead review C1-A):
 * - meta.root
 * - CFDocument.absPath (canonicalize)
 * - CFDocument.relPath (recompute relative to repoRoot)
 * - CFSymbol.absPath (canonicalize)
 * - CFSymbol.relPath (recompute relative to repoRoot)
 * - CFSymbol.workspaceRel (set to provided arg)
 * - Relationship.source.file (must be a file-symbol id from PR1 contract — assert if not)
 */
export function reRootIR(ir: IR, repoRoot: string, workspaceRel: string): IR {
  const canonRepoRoot = canonicalizePath(repoRoot)

  const documents: CFDocument[] = ir.documents.map(d => {
    const canonAbs = canonicalizePath(d.absPath)
    return {
      ...d,
      absPath: canonAbs,
      relPath: posixRelative(canonRepoRoot, canonAbs),
    }
  })

  const symbols: CFSymbol[] = ir.symbols.map(s => {
    const canonAbs = canonicalizePath(s.absPath)
    return {
      ...s,
      absPath: canonAbs,
      relPath: posixRelative(canonRepoRoot, canonAbs),
      workspaceRel,
    }
  })

  // Defensive: PR1 contract requires Relationship.source.file (when present) to be
  // a file-symbol id (string starting with 'file::'). reRootIR doesn't rewrite the
  // value itself — the file-symbol's own absPath/relPath get rewritten via the
  // symbols map above, and the merger's byId remap handles the rest.
  const relationships = ir.relationships.map(r => {
    if (r.source && !r.source.file.startsWith('file::')) {
      throw new Error(
        `reRootIR: Relationship.source.file must be a file-symbol id (starting with "file::"); got "${r.source.file}". This indicates a PR1 contract violation in the upstream extractor.`,
      )
    }
    return r
  })

  return {
    ...ir,
    meta: { ...ir.meta, root: canonRepoRoot },
    documents,
    symbols,
    relationships,
  }
}
