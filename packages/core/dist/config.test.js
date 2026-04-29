import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig, defaultConfig } from './config.js';
import path from 'node:path';
describe('loadConfig', () => {
    afterEach(async () => {
        const fs = await import('node:fs');
        fs.rmSync('/tmp/codeflow-test-config', { recursive: true, force: true });
    });
    it('returns defaults when no config file found', () => {
        const cfg = loadConfig('/tmp/no-such-dir');
        expect(cfg.logLevel).toBe('info');
        expect(cfg.previewCap).toBe(8);
        expect(cfg.idleTimeoutMs).toBe(600_000);
        expect(cfg.subprocessTimeoutMs).toBe(90_000);
    });
    it('merges partial user config over defaults', async () => {
        const fs = await import('node:fs');
        const dir = '/tmp/codeflow-test-config';
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.codeflow.json'), JSON.stringify({ logLevel: 'debug' }));
        const cfg = loadConfig(dir);
        expect(cfg.logLevel).toBe('debug');
        expect(cfg.previewCap).toBe(8);
    });
    it('throws a readable error on malformed config JSON', async () => {
        const fs = await import('node:fs');
        const dir = '/tmp/codeflow-test-config';
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.codeflow.json'), '{ invalid json }');
        expect(() => loadConfig(dir)).toThrow('Failed to parse config file');
    });
});
describe('defaultConfig', () => {
    it('has all required fields', () => {
        expect(defaultConfig).toMatchObject({
            logLevel: 'info',
            previewCap: 8,
            idleTimeoutMs: 600_000,
            subprocessTimeoutMs: 90_000,
            watcherDebounceMs: 200,
            requireManualApply: false,
            portRangeStart: 7800,
            portRangeEnd: 7900,
        });
    });
});
//# sourceMappingURL=config.test.js.map