import type { IR } from '@codeflow/core';
/**
 * Rewrite cross-workspace external references to point at internal file-symbols
 * when the SCIP package name matches a workspace's displayName.
 *
 * Pre-condition: ir.symbols and ir.relationships have already been canonically
 * merged via canonicalMerge. ir.meta.workspaces is populated with displayName
 * per workspaceRel.
 *
 * Returns a new IR with relationships rewritten (symbols are unchanged).
 *
 * # Why this is needed
 *
 * canonicalMerge enforces "one file on disk → one node in the merged graph."
 * File-symbols (id: `file::<absPath>`) survive; SCIP named symbols (e.g.
 * `scip-typescript npm @codeflow/core 0.1.0 src/`errors.ts`/CodeflowError#`)
 * get deduped away. Post-merge, only file-symbols exist as internal nodes.
 *
 * # Empirical basis (captured 2026-04-30 from real codeflow repo)
 *
 * Running scip-typescript on packages/core (the "Definition" side) emits:
 *   Definition: scip-typescript npm @codeflow/core 0.1.0 src/`errors.ts`/CodeflowError#
 *   Definition: scip-typescript npm @codeflow/core 0.1.0 src/`errors.ts`/createError().
 *   Definition: scip-typescript npm @codeflow/core 0.1.0 src/`index.ts`/
 *
 * Running scip-typescript on packages/cli (imports core via pnpm symlink
 * node_modules/@codeflow/core → ../core) emits references using the compiled dist:
 *   Reference: scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/CodeflowError#
 *   Reference: scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/createError().
 *   Reference: scip-typescript npm @codeflow/core 0.1.0 dist/`index.d.ts`/
 *
 * The package portion (@codeflow/core 0.1.0) matches. The file path differs:
 *   src/`<name>.ts`  (source, Definition side)
 *   dist/`<name>.d.ts` (compiled, Reference side)
 *
 * Since SCIP named defs are dropped by canonicalMerge, we stitch to the file-symbol
 * of the corresponding internal source file. We match by:
 *   (pkgName, moduleKey)
 * where moduleKey strips the src|dist prefix and .ts|.d.ts|.tsx|.js extension
 * from the backtick-wrapped file token.
 *
 * Example: `dist/`errors.d.ts`` → moduleKey="errors" → matches file-symbol for
 * packages/core/src/errors.ts whose workspaceRel="packages/core" and displayName="@codeflow/core".
 */
export declare function stitchCrossWorkspaceEdges(ir: IR): IR;
//# sourceMappingURL=cross-workspace-stitch.d.ts.map