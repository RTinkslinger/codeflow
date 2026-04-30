import { describe, it, expect } from 'vitest';
import { runPerWorkspace } from './run-per-workspace.js';
const fakeWs = [
    { workspaceRel: 'a', workspacePath: '/r/a' },
    { workspaceRel: 'b', workspacePath: '/r/b' },
    { workspaceRel: 'c', workspacePath: '/r/c' },
];
describe('runPerWorkspace', () => {
    it('runs all workspaces and returns results', async () => {
        const out = await runPerWorkspace(fakeWs, async (w) => ({ ws: w.workspaceRel }), { concurrency: 2, timeoutMs: 5_000, laneBudgetMs: 30_000 });
        expect(out.results.length).toBe(3);
        expect(out.errors.length).toBe(0);
        expect(out.cancelled).toBe(false);
    });
    it('captures per-item errors without aborting other items', async () => {
        const out = await runPerWorkspace(fakeWs, async (w) => {
            if (w.workspaceRel === 'a')
                throw new Error('boom');
            return { ws: w.workspaceRel };
        }, { concurrency: 2, timeoutMs: 5_000, laneBudgetMs: 30_000 });
        expect(out.results.length).toBe(2); // b, c succeeded
        expect(out.errors.length).toBe(1);
        expect(out.errors[0].workspace.workspaceRel).toBe('a');
    });
    it('respects concurrency cap', async () => {
        let inflight = 0;
        let maxInflight = 0;
        const out = await runPerWorkspace(fakeWs, async (_w) => {
            inflight++;
            maxInflight = Math.max(maxInflight, inflight);
            await new Promise(r => setTimeout(r, 30));
            inflight--;
            return 'ok';
        }, { concurrency: 2, timeoutMs: 5_000, laneBudgetMs: 30_000 });
        expect(out.results.length).toBe(3);
        expect(maxInflight).toBeLessThanOrEqual(2);
    });
    it('per-item timeout aborts the signal but allows other items to continue', async () => {
        const out = await runPerWorkspace(fakeWs, async (w, signal) => {
            if (w.workspaceRel === 'a') {
                // Simulate a long task that honors the abort signal
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(resolve, 5_000);
                    signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new Error('aborted'));
                    });
                });
                return 'unreachable';
            }
            return 'ok';
        }, { concurrency: 3, timeoutMs: 100, laneBudgetMs: 30_000 });
        expect(out.results.length).toBe(2); // b, c
        expect(out.errors.length).toBe(1);
        expect(out.errors[0].workspace.workspaceRel).toBe('a');
    });
    it('lane budget cancellation marks cancelled=true and aborts in-flight', async () => {
        const items = Array.from({ length: 5 }, (_, i) => ({
            workspaceRel: `ws${i}`,
            workspacePath: `/r/ws${i}`,
        }));
        const out = await runPerWorkspace(items, async (_w, signal) => {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 1_000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new Error('aborted'));
                });
            });
            return 'ok';
        }, { concurrency: 2, timeoutMs: 5_000, laneBudgetMs: 100 });
        expect(out.cancelled).toBe(true);
        // Some may have completed before the budget fired; rest are errors
        expect(out.results.length + out.errors.length).toBe(5);
    });
});
//# sourceMappingURL=run-per-workspace.test.js.map