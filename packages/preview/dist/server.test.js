import { describe, it, expect, afterEach } from 'vitest';
import { allocatePort, PreviewServer } from './server.js';
import http from 'node:http';
describe('allocatePort', () => {
    it('returns a port in the configured range', async () => {
        const port = await allocatePort({ start: 7800, end: 7900 });
        expect(port).toBeGreaterThanOrEqual(7800);
        expect(port).toBeLessThanOrEqual(7900);
    });
    it('falls back to OS-assigned port if range is exhausted', async () => {
        // Force range to a very narrow window
        const port = await allocatePort({ start: 0, end: 0 });
        expect(typeof port).toBe('number');
        expect(port).toBeGreaterThan(0);
    });
});
describe('PreviewServer', () => {
    let server = null;
    afterEach(async () => { await server?.stop(); });
    it('starts and serves the preview page on allocated port', async () => {
        server = new PreviewServer();
        const { port } = await server.start();
        expect(port).toBeGreaterThan(0);
        const body = await new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${port}/`, (r) => {
                let d = '';
                r.on('data', c => d += c);
                r.on('end', () => res(d));
            }).on('error', rej);
        });
        expect(body).toContain('codeflow');
    });
    it('stops cleanly', async () => {
        server = new PreviewServer();
        await server.start();
        await expect(server.stop()).resolves.not.toThrow();
        server = null;
    });
});
//# sourceMappingURL=server.test.js.map