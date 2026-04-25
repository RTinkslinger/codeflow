import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Must declare captured state before the mock factory runs
const capturedArgs = [];
// Mock node:child_process to intercept depcruise spawn args without running the real binary.
// We set the promisify.custom symbol because Node's execFile uses it — without it, promisify
// ignores our mock's callback implementation.
vi.mock('node:child_process', async () => {
    const PROMISIFY_CUSTOM = Symbol.for('nodejs.util.promisify.custom');
    const mockExecFile = vi.fn();
    mockExecFile[PROMISIFY_CUSTOM] = (_cmd, args, _opts) => {
        capturedArgs.push([...args]);
        return Promise.resolve({ stdout: '{"modules": []}', stderr: '' });
    };
    return { execFile: mockExecFile };
});
import { DepcruiseExtractor } from './index.js';
describe('DepcruiseExtractor spawn invocation', () => {
    let tmpDir;
    beforeEach(() => {
        capturedArgs.length = 0;
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow-inv-test-'));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it('passes --exclude to depcruise to prevent node_modules and .git crawl', async () => {
        const extractor = new DepcruiseExtractor();
        await extractor.extract({ path: tmpDir, root: tmpDir });
        expect(capturedArgs).toHaveLength(1);
        const args = capturedArgs[0];
        expect(args).toContain('--exclude');
        const excludeIdx = args.indexOf('--exclude');
        const excludePattern = args[excludeIdx + 1] ?? '';
        expect(excludePattern).toMatch(/node_modules/);
        expect(excludePattern).toMatch(/\.git/);
    });
});
//# sourceMappingURL=index.invocation.test.js.map