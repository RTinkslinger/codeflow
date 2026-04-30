import type { IR } from '@codeflow/core';
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
export declare function reRootIR(ir: IR, repoRoot: string, workspaceRel: string): IR;
//# sourceMappingURL=re-root-ir.d.ts.map