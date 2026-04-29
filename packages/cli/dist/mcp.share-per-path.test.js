import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { CodeflowMCP } from './mcp.js';
const FIXTURE = path.resolve(__dirname, '../../canonical/tests/fixtures/ws-pnpm');
describe('mcp share-per-path canonical-key', () => {
    let mcp;
    afterEach(async () => {
        if (mcp) {
            const list = await mcp.listPreviews();
            for (const p of list)
                await mcp.stopPreview({ previewId: p.previewId });
        }
    });
    it('reuses preview when called with nested path in same monorepo', async () => {
        mcp = new CodeflowMCP();
        const a = await mcp.startPreview({ path: FIXTURE });
        const b = await mcp.startPreview({ path: path.join(FIXTURE, 'packages/alpha') });
        expect(b.previewId).toBe(a.previewId);
    }, 30_000);
    it('different repos get different previews', async () => {
        mcp = new CodeflowMCP();
        const FIXTURE2 = path.resolve(__dirname, '../../canonical/tests/fixtures/ws-pkgjson');
        const a = await mcp.startPreview({ path: FIXTURE });
        const b = await mcp.startPreview({ path: FIXTURE2 });
        expect(b.previewId).not.toBe(a.previewId);
    }, 30_000);
});
//# sourceMappingURL=mcp.share-per-path.test.js.map