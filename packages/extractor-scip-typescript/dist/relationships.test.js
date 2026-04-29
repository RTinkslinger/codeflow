import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ScipTypescriptExtractor } from './index.js';
const FIXTURE_B = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg/pkg-b');
describe('scip-typescript: import/reference relationships', () => {
    it('emits relationships from non-Definition occurrences', async () => {
        const ex = new ScipTypescriptExtractor();
        const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B });
        expect(result.ir.relationships.length).toBeGreaterThan(0);
        // Every relationship.from must be a file-symbol id (PR1 contract)
        expect(result.ir.relationships.every(r => r.from.startsWith('file::'))).toBe(true);
        // Every relationship.from must resolve via byId — that is, exist in ir.symbols
        const symIds = new Set(result.ir.symbols.map(s => s.id));
        for (const r of result.ir.relationships) {
            expect(symIds.has(r.from), `relationship.from "${r.from}" not in symbols`).toBe(true);
        }
        // Per Phase 0: scip-typescript emits roles=0 (reference) for all cross-file refs;
        // it does NOT set the Import bit (0x2). So we expect at least 'references' relationships.
        // The 'imports' branch is defensive (scip-python / future versions may use bit 0x2).
        expect(result.ir.relationships.every(r => r.kind === 'imports' || r.kind === 'references')).toBe(true);
        expect(result.ir.relationships.some(r => r.kind === 'references')).toBe(true);
    }, 120_000);
});
//# sourceMappingURL=relationships.test.js.map