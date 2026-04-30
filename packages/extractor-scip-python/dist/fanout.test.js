import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ScipPythonExtractor } from './index.js';
const FIXTURE = path.resolve(__dirname, '../../test-utils/fixtures/monorepo-2pkg-py');
describe('scip-python fan-out', () => {
    it('extracts from all detected workspaces', async () => {
        const ex = new ScipPythonExtractor();
        const result = await ex.extract({ path: FIXTURE, root: FIXTURE });
        expect(result.ir.symbols.some(s => s.workspaceRel === 'packages/pkg-a')).toBe(true);
        expect(result.ir.symbols.some(s => s.workspaceRel === 'packages/pkg-b')).toBe(true);
        expect(result.ir.meta.workspaces).toBeDefined();
        expect(Object.keys(result.ir.meta.workspaces)).toContain('packages/pkg-a');
        expect(Object.keys(result.ir.meta.workspaces)).toContain('packages/pkg-b');
    }, 180_000);
});
//# sourceMappingURL=fanout.test.js.map