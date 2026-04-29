import { describe, it, expect } from 'vitest';
import { mergeIRs } from './merger.js';
const baseIR = (root, partial, workspaces) => ({
    schemaVersion: '1',
    meta: {
        extractor: { name: 'x', version: '1', invocation: 'i' },
        root,
        ...(partial !== undefined ? { partial } : {}),
        ...(workspaces ? { workspaces } : {}),
    },
    documents: [],
    symbols: [],
    relationships: [],
});
describe('mergeIRs partial-flag OR + workspaces union', () => {
    it('ORs partial: any input partial → output partial', () => {
        const a = baseIR('/r', false);
        const b = baseIR('/r', true);
        const merged = mergeIRs([a, b]);
        expect(merged.meta.partial).toBe(true);
    });
    it('output is non-partial only when all inputs are non-partial', () => {
        const merged = mergeIRs([baseIR('/r', false), baseIR('/r', false)]);
        expect(merged.meta.partial === true).toBe(false);
    });
    it('handles inputs without partial field (treats as non-partial)', () => {
        const merged = mergeIRs([baseIR('/r'), baseIR('/r')]);
        expect(merged.meta.partial === true).toBe(false);
    });
    it('any partial=true wins even when others have no partial field', () => {
        const merged = mergeIRs([baseIR('/r'), baseIR('/r', true), baseIR('/r')]);
        expect(merged.meta.partial).toBe(true);
    });
    it('unions workspaces maps from all inputs', () => {
        const a = baseIR('/r', false, { 'packages/a': { displayName: 'a', manifest: 'pnpm' } });
        const b = baseIR('/r', false, { 'packages/b': { displayName: 'b', manifest: 'pnpm' } });
        const merged = mergeIRs([a, b]);
        expect(merged.meta.workspaces).toEqual({
            'packages/a': { displayName: 'a', manifest: 'pnpm' },
            'packages/b': { displayName: 'b', manifest: 'pnpm' },
        });
    });
    it('omits workspaces field when no input has one', () => {
        const merged = mergeIRs([baseIR('/r'), baseIR('/r')]);
        expect(merged.meta.workspaces).toBeUndefined();
    });
});
//# sourceMappingURL=merger-partial-or.test.js.map