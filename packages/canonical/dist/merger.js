import { canonicalizePath } from './canonicalizer.js';
import { InvariantError } from './errors.js';
// File-level kinds participate in the "one file on disk → one node" invariant.
// Other kinds (functions, classes, methods, etc.) can legitimately share absPath
// when multiple Definitions live in the same file.
const FILE_LEVEL_KINDS = new Set(['file', 'module']);
export function canonicalMerge(symbols, _root, relationships = []) {
    // _root: reserved for posixRelative calls in later tasks (Task 18 production pipeline)
    //
    // THE LOAD-BEARING INVARIANT: one file on disk → exactly one FILE-LEVEL node.
    // Function/class/method Definitions inside that file remain distinct nodes.
    //
    // Pre-M2 the merger keyed everything on absPath, which collapsed every
    // SCIP Definition into its containing file-symbol → graph showed only
    // file nodes. Post-M2 we scope absPath dedup to file-level kinds.
    //
    // Two failure modes still guarded:
    //   A. Same id, different paths (truly irreconcilable) → InvariantError
    //   B. Different ids, same canonical path, BOTH file-level (cross-extractor:
    //      depcruise emits 'module', scip-ts emits 'file' for the same file)
    //      → keep one winner (prefer verified confidence), remap loser id.
    //
    // byPath: file-level symbols only (one per canonical absPath).
    // byNonFileId: function/class/etc. (deduped by id only).
    // byId: any-id → winner-id (for relationship endpoint rewriting).
    const byPath = new Map();
    const byNonFileId = new Map();
    const byId = new Map();
    for (const sym of symbols) {
        const canonPath = canonicalizePath(sym.absPath);
        const isFileLevel = FILE_LEVEL_KINDS.has(sym.kind);
        // Check failure mode A: same id, different canonical paths
        const existingWinnerId = byId.get(sym.id);
        if (existingWinnerId !== undefined) {
            const winner = byPath.get(canonPath) ?? byNonFileId.get(existingWinnerId);
            if (winner !== undefined && canonicalizePath(winner.absPath) !== canonPath) {
                throw new InvariantError(`Symbol id collision: "${sym.id}" resolves to both "${winner.absPath}" and "${sym.absPath}"`, { id: sym.id, path1: winner.absPath, path2: sym.absPath });
            }
            continue; // already mapped, same path
        }
        if (!isFileLevel) {
            // Non-file-level symbol: dedupe by id only.
            // Two SCIP Definitions with the same id are the same definition.
            const canonical = { ...sym, absPath: canonPath };
            byNonFileId.set(sym.id, canonical);
            byId.set(sym.id, sym.id);
            continue;
        }
        // File-level symbol: dedupe by canonical absPath
        const existing = byPath.get(canonPath);
        if (existing === undefined) {
            const canonical = { ...sym, absPath: canonPath };
            byPath.set(canonPath, canonical);
            byId.set(sym.id, sym.id);
        }
        else {
            // Failure mode B: different id, same path, both file-level
            if (sym.confidence === 'verified' && existing.confidence === 'inferred') {
                const upgraded = { ...existing, confidence: 'verified' };
                byPath.set(canonPath, upgraded);
            }
            byId.set(sym.id, existing.id);
        }
    }
    // Rewrite relationship endpoints using byId remap
    const remappedRels = relationships.map(rel => ({
        ...rel,
        from: byId.get(rel.from) ?? rel.from,
        to: byId.get(rel.to) ?? rel.to,
    })).filter(rel => rel.from !== rel.to); // drop self-loops created by dedup
    // Deduplicate relationships by (from, to, kind) after remap
    const relMap = new Map();
    for (const rel of remappedRels) {
        const key = `${rel.from}::${rel.to}::${rel.kind}`;
        const existing = relMap.get(key);
        if (existing === undefined || (rel.confidence === 'verified' && existing.confidence === 'inferred')) {
            relMap.set(key, rel);
        }
    }
    return {
        symbols: [...byPath.values(), ...byNonFileId.values()],
        relationships: [...relMap.values()],
    };
}
//# sourceMappingURL=merger.js.map