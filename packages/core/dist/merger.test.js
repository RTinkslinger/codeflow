import { describe, it, expect } from 'vitest';
import { mergeIRs, computeDiff } from './merger.js';
const BASE_META = { extractor: { name: 'test', version: '1', invocation: '' }, root: '/project' };
describe('mergeIRs', () => {
    it('merges two IRs — combines symbols, deduplicates by id', () => {
        const a = { schemaVersion: '1', meta: BASE_META, documents: [], symbols: [{ id: 'sym:a', kind: 'function', name: 'a', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' }], relationships: [] };
        const b = { schemaVersion: '1', meta: BASE_META, documents: [], symbols: [{ id: 'sym:a', kind: 'function', name: 'a', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' }, { id: 'sym:b', kind: 'function', name: 'b', absPath: '/p/b.ts', relPath: 'b.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' }], relationships: [] };
        const merged = mergeIRs([a, b]);
        expect(merged.symbols).toHaveLength(2); // deduped
    });
    it('promotes inferred→verified when same id appears in both', () => {
        const inferred = { schemaVersion: '1', meta: BASE_META, documents: [], symbols: [{ id: 'sym:x', kind: 'function', name: 'x', absPath: '/p/x.ts', relPath: 'x.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' }], relationships: [] };
        const verified = { schemaVersion: '1', meta: BASE_META, documents: [], symbols: [{ id: 'sym:x', kind: 'function', name: 'x', absPath: '/p/x.ts', relPath: 'x.ts', language: 'ts', origin: 'extractor', confidence: 'verified' }], relationships: [] };
        const merged = mergeIRs([inferred, verified]);
        expect(merged.symbols[0]?.confidence).toBe('verified');
    });
    it('returns empty IR for empty input', () => {
        const merged = mergeIRs([]);
        expect(merged.symbols).toHaveLength(0);
        expect(merged.relationships).toHaveLength(0);
    });
});
let _relId = 0;
const mkIR = (rels) => ({
    schemaVersion: '1', meta: BASE_META, documents: [], symbols: [],
    relationships: rels.map(r => ({ id: `rel:${++_relId}`, language: 'ts', origin: 'extractor', ...r })),
});
describe('computeDiff', () => {
    it('returns all relationships as added when previous is null', () => {
        const curr = mkIR([{ from: 'a', to: 'b', kind: 'calls', confidence: 'inferred' }]);
        const diff = computeDiff(null, curr);
        expect(diff.added).toHaveLength(1);
        expect(diff.removed).toHaveLength(0);
        expect(diff.upgraded).toHaveLength(0);
    });
    it('detects added and removed relationships', () => {
        const prev = mkIR([{ from: 'a', to: 'b', kind: 'calls', confidence: 'inferred' }]);
        const curr = mkIR([{ from: 'b', to: 'c', kind: 'imports', confidence: 'inferred' }]);
        const diff = computeDiff(prev, curr);
        expect(diff.added).toHaveLength(1);
        expect(diff.added[0].from).toBe('b');
        expect(diff.removed).toHaveLength(1);
        expect(diff.removed[0].from).toBe('a');
        expect(diff.upgraded).toHaveLength(0);
    });
    it('detects confidence upgrade from inferred to verified', () => {
        const prev = mkIR([{ from: 'a', to: 'b', kind: 'calls', confidence: 'inferred' }]);
        const curr = mkIR([{ from: 'a', to: 'b', kind: 'calls', confidence: 'verified' }]);
        const diff = computeDiff(prev, curr);
        expect(diff.added).toHaveLength(0);
        expect(diff.removed).toHaveLength(0);
        expect(diff.upgraded).toHaveLength(1);
        expect(diff.upgraded[0].confidence).toBe('verified');
    });
});
//# sourceMappingURL=merger.test.js.map