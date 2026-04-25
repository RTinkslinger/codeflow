import { canonicalizePath } from './canonicalizer.js';
import { InvariantError } from './errors.js';
export function canonicalMerge(symbols, _root, relationships = []) {
    // _root: reserved for posixRelative calls in later tasks (Task 18 production pipeline)
    // THE LOAD-BEARING INVARIANT: one file on disk → exactly one node in the merged graph.
    //
    // Two failure modes this must guard:
    //   A. Same id, different paths (truly irreconcilable) → InvariantError
    //   B. Different ids, same canonical path (cross-extractor: depcruise + scip-ts both saw the same file)
    //      → keep one winner (prefer verified confidence), remap loser IDs in relationships
    //
    // byPath is authoritative: one entry per canonical absPath.
    // byId tracks any-id → winner-id for relationship endpoint rewriting.
    const byPath = new Map(); // canonPath → winner symbol
    const byId = new Map(); // any-id → winner-id (for relationship rewrite)
    for (const sym of symbols) {
        const canonPath = canonicalizePath(sym.absPath);
        // Check failure mode A: same id, different canonical paths
        const existingWinnerId = byId.get(sym.id);
        if (existingWinnerId !== undefined) {
            // O(n) scan — acceptable at v1 scale; a reverse winnerId→CFSymbol map would make this O(1)
            const winner = [...byPath.values()].find(s => s.id === existingWinnerId);
            if (winner !== undefined && canonicalizePath(winner.absPath) !== canonPath) {
                throw new InvariantError(`Symbol id collision: "${sym.id}" resolves to both "${winner.absPath}" and "${sym.absPath}"`, { id: sym.id, path1: winner.absPath, path2: sym.absPath });
            }
            continue; // already mapped, same path
        }
        const existing = byPath.get(canonPath);
        if (existing === undefined) {
            // First symbol for this path — it wins
            const canonical = { ...sym, absPath: canonPath };
            byPath.set(canonPath, canonical);
            byId.set(sym.id, sym.id);
        }
        else {
            // Failure mode B: different id, same path (cross-extractor duplicate)
            // Keep existing winner, but prefer verified confidence
            if (sym.confidence === 'verified' && existing.confidence === 'inferred') {
                const upgraded = { ...existing, confidence: 'verified' };
                byPath.set(canonPath, upgraded);
            }
            // Remap this symbol's id → winner's id (for relationship endpoint rewrite)
            byId.set(sym.id, existing.id);
        }
    }
    // Rewrite relationship endpoints using idRemap
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
        symbols: [...byPath.values()],
        relationships: [...relMap.values()],
    };
}
//# sourceMappingURL=merger.js.map