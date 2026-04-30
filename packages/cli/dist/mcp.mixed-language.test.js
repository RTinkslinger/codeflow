import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { CodeflowMCP } from './mcp.js';
const FIXTURE = path.resolve(__dirname, '../../test-utils/fixtures/monorepo-3pkg-mixed');
const HAS_SCIP_TS = (() => { try {
    execSync('scip-typescript --version', { stdio: 'ignore' });
    return true;
}
catch {
    return false;
} })();
const HAS_SCIP_PY = (() => { try {
    execSync('scip-python --version', { stdio: 'ignore' });
    return true;
}
catch {
    return false;
} })();
describe.skipIf(!HAS_SCIP_TS || !HAS_SCIP_PY)('mcp mixed-language monorepo (TS + Py)', () => {
    let mcp;
    const broadcasts = [];
    afterEach(async () => {
        if (mcp) {
            const list = await mcp.listPreviews();
            for (const p of list)
                await mcp.stopPreview({ previewId: p.previewId });
        }
        broadcasts.length = 0;
        mcp = undefined;
    });
    it('detects TS pkg-a, TS pkg-b, Python pkg-c (setup.py-only) in a single graph', async () => {
        mcp = new CodeflowMCP();
        const { previewId } = await mcp.startPreview({ path: FIXTURE, verified: true });
        const previews = mcp.previews;
        const record = previews.get(previewId);
        if (!record)
            throw new Error('preview record not found');
        const origBroadcast = record.broadcaster.broadcast.bind(record.broadcaster);
        record.broadcaster.broadcast = (msg) => {
            broadcasts.push(msg);
            origBroadcast(msg);
        };
        const start = Date.now();
        while (Date.now() - start < 120_000) {
            if (broadcasts.some(m => m.type === 'verified_ready'))
                break;
            await new Promise(r => setTimeout(r, 500));
        }
        const verified = [...broadcasts].reverse().find((m) => m.type === 'verified_ready');
        expect(verified, 'verified_ready broadcast not received within 120s').toBeDefined();
        // Pull the IR via get_ir
        const irResult = await mcp.getIR({ previewId });
        expect(irResult).toBeDefined();
        const ir = irResult.ir;
        expect(ir).not.toBeNull();
        if (!ir)
            throw new Error('ir is null');
        expect(ir.meta.workspaces).toBeDefined();
        const workspaces = ir.meta.workspaces;
        const wsRels = Object.keys(workspaces).sort();
        // pkg-c may surface as packages/pkg-c relative to fixture root
        expect(wsRels).toContain('packages/pkg-a');
        expect(wsRels).toContain('packages/pkg-b');
        expect(wsRels).toContain('packages/pkg-c');
        const pkgC = workspaces['packages/pkg-c'];
        const pkgA = workspaces['packages/pkg-a'];
        const pkgB = workspaces['packages/pkg-b'];
        expect(pkgC).toBeDefined();
        expect(pkgA).toBeDefined();
        expect(pkgB).toBeDefined();
        if (!pkgC || !pkgA || !pkgB)
            throw new Error('one or more workspaces missing from IR');
        // pkg-c manifest is setup.py
        expect(pkgC.manifest).toBe('setup.py');
        // pkg-c displayName extracted from setup.py name=
        expect(pkgC.displayName).toBe('mixed-pkg-c');
        // pkg-a and pkg-b manifests are pnpm
        expect(pkgA.manifest).toBe('pnpm');
        expect(pkgB.manifest).toBe('pnpm');
    }, 180_000);
});
//# sourceMappingURL=mcp.mixed-language.test.js.map