import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canonicalMerge } from './merger.js';
import { InvariantError } from './errors.js';
const sym = (id, confidence = 'inferred') => ({
    id, kind: 'function', name: id, absPath: `/p/${id}.ts`, relPath: `${id}.ts`,
    language: 'ts', origin: 'extractor', confidence,
});
describe('canonicalMerge — one file on disk → one node', () => {
    it('deduplicates symbols by canonicalized absPath', () => {
        const a = { ...sym('tsc:typescript:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' };
        const b = { ...sym('scip:typescript:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' };
        const result = canonicalMerge([a, b], '/p');
        expect(result.symbols).toHaveLength(1);
    });
    it('throws InvariantError on irreconcilable id collision', () => {
        // Same id, different absPath — canonicalizer cannot merge these
        const x = { ...sym('id:collision'), absPath: '/p/a.ts', relPath: 'a.ts' };
        const y = { ...sym('id:collision'), absPath: '/p/b.ts', relPath: 'b.ts' };
        expect(() => canonicalMerge([x, y], '/p')).toThrow(InvariantError);
    });
    it('property: output symbol count <= input symbol count', () => {
        fc.assert(fc.property(fc.array(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 10 }), (ids) => {
            const symbols = ids.map(id => sym(`tsc:ts:src/${id}:fn`));
            const result = canonicalMerge(symbols, '/p');
            expect(result.symbols.length).toBeLessThanOrEqual(symbols.length);
        }));
    });
});
const rel = (from, to, confidence = 'inferred') => ({
    id: `${from}->${to}`,
    from, to,
    kind: 'imports',
    language: 'ts',
    confidence,
});
describe('canonicalMerge — relationship rewriting', () => {
    it('rewrites loser id in relationship endpoints to winner id', () => {
        const a = { ...sym('tsc:ts:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' };
        const b = { ...sym('scip:ts:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' };
        const c = sym('tsc:ts:src/b:fn'); // separate file
        // relationship from loser (b) to c should be rewritten to winner (a) → c
        const relationship = rel('scip:ts:src/a:fn', 'tsc:ts:src/b:fn');
        const result = canonicalMerge([a, b, c], '/p', [relationship]);
        expect(result.relationships).toHaveLength(1);
        expect(result.relationships[0]?.from).toBe('tsc:ts:src/a:fn');
    });
    it('drops self-loops created by dedup', () => {
        const a = { ...sym('tsc:ts:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' };
        const b = { ...sym('scip:ts:src/a:fn'), absPath: '/p/a.ts', relPath: 'a.ts' };
        // a relationship from loser to winner becomes self-loop after remap — must be dropped
        const selfLoopRel = rel('scip:ts:src/a:fn', 'tsc:ts:src/a:fn');
        const result = canonicalMerge([a, b], '/p', [selfLoopRel]);
        expect(result.relationships).toHaveLength(0);
    });
    it('prefers verified relationship over inferred with same (from, to, kind) key', () => {
        const a = sym('tsc:ts:src/a:fn');
        const b = sym('tsc:ts:src/b:fn');
        const inferred = rel(a.id, b.id, 'inferred');
        const verified = rel(a.id, b.id, 'verified');
        const result = canonicalMerge([a, b], '/p', [inferred, verified]);
        expect(result.relationships).toHaveLength(1);
        expect(result.relationships[0]?.confidence).toBe('verified');
    });
});
//# sourceMappingURL=merger.test.js.map