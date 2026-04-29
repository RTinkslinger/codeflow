import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { ScipPythonExtractor } from './index.js';
const HAS_SCIP = (() => {
    try {
        execSync('scip-python --version', { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
})();
const FIXTURE_B = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg-py/pkg-b');
describe.skipIf(!HAS_SCIP)('scip-python: human-readable symbol names', () => {
    it('extracts readable names from SCIP descriptors', async () => {
        const ex = new ScipPythonExtractor();
        const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B });
        const names = result.ir.symbols.filter(s => s.kind !== 'file').map(s => s.name);
        // pkg-b defines `main`
        expect(names).toContain('main');
        for (const name of names) {
            expect(name).not.toMatch(/^scip-python /);
            expect(name).not.toContain(' python ');
            // No raw SCIP suffix punctuation: backticks, method parens, type markers
            expect(name).not.toMatch(/[`(){}#]/);
            // Must not end with a bare SCIP suffix (. or # or : or [])
            expect(name).not.toMatch(/[.#:[\]]+$/);
        }
    }, 120_000);
});
//# sourceMappingURL=symbol-name.test.js.map