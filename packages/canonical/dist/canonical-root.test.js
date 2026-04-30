import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { resolveCanonicalRoot } from './canonical-root.js';
import { canonicalizePath } from './canonicalizer.js';
// Isolated temp dir for the "no manifest, no .git" test — must live outside
// the codeflow git tree, otherwise the walk-up will find codeflow's own
// pnpm-workspace.yaml before hitting filesystem root.
let tmpIsolated;
beforeAll(async () => {
    tmpIsolated = await fs.mkdtemp(path.join(os.tmpdir(), 'codeflow-canonical-root-test-'));
    // Create a subdirectory to walk up from
    await fs.mkdir(path.join(tmpIsolated, 'nested'), { recursive: true });
});
afterAll(async () => {
    await fs.rm(tmpIsolated, { recursive: true, force: true });
});
describe('resolveCanonicalRoot', () => {
    it('returns repo root from a nested path', async () => {
        const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm');
        const nested = path.join(root, 'packages/alpha');
        const r = await resolveCanonicalRoot(nested);
        expect(r).toBe(root);
    });
    it('returns the path itself when called at repo root', async () => {
        const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm');
        const r = await resolveCanonicalRoot(root);
        expect(r).toBe(root);
    });
    it('returns the path itself when no manifest found (no .git boundary)', async () => {
        // Use an isolated temp dir outside the codeflow repo so the walk-up
        // finds no workspace manifest and no .git, stopping at filesystem root.
        const nested = path.join(tmpIsolated, 'nested');
        const r = await resolveCanonicalRoot(nested);
        // canonicalizePath resolves symlinks (macOS /var -> /private/var), so
        // compare the canonicalized nested dir rather than the raw tmpdir path.
        expect(r).toBe(canonicalizePath(nested));
    });
    it('detects pyproject workspace tables', async () => {
        const root = path.resolve(__dirname, '../tests/fixtures/ws-py-uv');
        const nested = path.join(root, 'packages/alpha');
        const r = await resolveCanonicalRoot(nested);
        expect(r).toBe(root);
    });
    it('detects pkgjson with workspaces field', async () => {
        const root = path.resolve(__dirname, '../tests/fixtures/ws-pkgjson');
        const nested = path.join(root, 'packages/x');
        const r = await resolveCanonicalRoot(nested);
        expect(r).toBe(root);
    });
});
//# sourceMappingURL=canonical-root.test.js.map