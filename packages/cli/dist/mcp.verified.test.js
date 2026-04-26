import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { CodeflowMCP } from './mcp.js';
import { loadFixture } from '@codeflow/test-utils';
const HAS_SCIP_TS = (() => { try {
    execSync('scip-typescript --version', { stdio: 'ignore' });
    return true;
}
catch {
    return false;
} })();
describe.skipIf(!HAS_SCIP_TS)('Verified lane', () => {
    let mcp;
    beforeEach(() => { mcp = new CodeflowMCP(); });
    afterEach(async () => { await mcp.shutdown(); });
    it('startPreview with verified:true triggers both fast and verified extraction', async () => {
        const p = loadFixture('pure-ts');
        const { previewId } = await mcp.startPreview({ path: p, verified: true });
        // Wait for verified to complete (up to 120s)
        let ir = null;
        const start = Date.now();
        while (Date.now() - start < 120_000) {
            const result = await mcp.getIR({ previewId });
            if (result.status === 'ready' && result.ir) {
                ir = result.ir;
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        expect(ir).not.toBeNull();
        expect(ir.symbols.some(s => s.confidence === 'verified')).toBe(true);
    }, 130_000);
});
//# sourceMappingURL=mcp.verified.test.js.map