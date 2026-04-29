import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ScipTypescriptExtractor } from './index.js';
import { canonicalMerge } from '@codeflow/canonical';
const FIXTURE_B = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg/pkg-b');
describe('scip-typescript: byId remap contract (property)', () => {
    it('every relationship.from is a file-symbol present in ir.symbols', async () => {
        const ex = new ScipTypescriptExtractor();
        const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B });
        const symIds = new Set(result.ir.symbols.map(s => s.id));
        for (const r of result.ir.relationships) {
            expect(symIds.has(r.from), `relationship.from "${r.from}" not in symbols`).toBe(true);
            expect(r.from.startsWith('file::')).toBe(true);
        }
    });
    it('canonicalMerge does not leak path strings — all surviving relationships have from in merged symbols', async () => {
        const ex = new ScipTypescriptExtractor();
        const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B });
        const merged = canonicalMerge(result.ir.symbols, FIXTURE_B, result.ir.relationships);
        for (const r of merged.relationships) {
            // After canonical merge, byId remapping may have rewritten 'from'
            // but the result must still be a known symbol id in the merged symbol set
            const symIds = new Set(merged.symbols.map(s => s.id));
            expect(symIds.has(r.from), `merged relationship.from "${r.from}" not in merged symbols`).toBe(true);
        }
    });
});
//# sourceMappingURL=relationships-byid.property.test.js.map