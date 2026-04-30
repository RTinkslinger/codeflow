import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ScipTypescriptExtractor } from './index.js';
const FIXTURE_A = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg/pkg-a');
describe('scip-typescript: file-symbol synthesis', () => {
    it('emits a kind:"file" symbol for each unique containing file', async () => {
        const ex = new ScipTypescriptExtractor();
        const result = await ex.extract({ path: FIXTURE_A, root: FIXTURE_A });
        const fileSymbols = result.ir.symbols.filter(s => s.kind === 'file');
        expect(fileSymbols.length).toBeGreaterThan(0);
        // All file-symbols must have id starting with 'file::'
        expect(fileSymbols.every(s => s.id.startsWith('file::'))).toBe(true);
        // file-symbol absPath equals canonicalized real file
        const indexFile = fileSymbols.find(s => s.absPath.endsWith('src/index.ts'));
        expect(indexFile).toBeDefined();
        expect(indexFile.id).toBe(`file::${indexFile.absPath}`);
        expect(indexFile.confidence).toBe('verified');
    }, 120_000);
});
//# sourceMappingURL=file-symbols.test.js.map