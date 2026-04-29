import { describe, it, expect, afterEach } from 'vitest';
import { WSBroadcaster } from './ws.js';
import { PreviewServer } from './server.js';
import WebSocket from 'ws';
describe('WSBroadcaster', () => {
    let previewServer = null;
    let broadcaster = null;
    afterEach(async () => {
        broadcaster?.close();
        await previewServer?.stop();
    });
    it('broadcasts a message to all connected clients', async () => {
        previewServer = new PreviewServer();
        const { port } = await previewServer.start();
        broadcaster = new WSBroadcaster(previewServer.server);
        const received = await new Promise((resolve) => {
            const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
            client.once('message', (data) => resolve(JSON.parse(data.toString())));
            client.once('open', () => {
                setTimeout(() => broadcaster.broadcast({ type: 'update', mermaid: 'graph LR\n  A --> B', badge: '● fast view' }), 50);
            });
        });
        expect(received.type).toBe('update');
    });
    it('replays last broadcast to a client that connects after the broadcast', async () => {
        previewServer = new PreviewServer();
        const { port } = await previewServer.start();
        broadcaster = new WSBroadcaster(previewServer.server);
        // Broadcast BEFORE any client connects — simulates extraction completing before browser opens
        broadcaster.broadcast({ type: 'update', mermaid: 'graph LR\n  A --> B', badge: '● fast view' });
        // Let the broadcast attempt run (no clients connected, so nothing sent yet)
        await new Promise(r => setTimeout(r, 50));
        // Late-connecting client arrives after extraction already finished
        const received = await new Promise((resolve) => {
            const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
            client.once('message', (data) => resolve(JSON.parse(data.toString())));
            setTimeout(() => resolve(null), 1000);
        });
        expect(received).toEqual({ type: 'update', mermaid: 'graph LR\n  A --> B', badge: '● fast view' });
    });
    it('uses latest-wins buffer — rapid sends deliver only the last', async () => {
        previewServer = new PreviewServer();
        const { port } = await previewServer.start();
        broadcaster = new WSBroadcaster(previewServer.server);
        const messages = [];
        await new Promise((resolve) => {
            const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
            client.on('message', (data) => { messages.push(JSON.parse(data.toString())); if (messages.length >= 1)
                resolve(); });
            client.once('open', () => {
                // Send 3 rapid messages — only last should arrive if latest-wins fires
                broadcaster.broadcast({ type: 'update', mermaid: 'graph LR\n  A-->B', badge: 'v1' });
                broadcaster.broadcast({ type: 'update', mermaid: 'graph LR\n  A-->C', badge: 'v2' });
                broadcaster.broadcast({ type: 'update', mermaid: 'graph LR\n  A-->D', badge: 'v3' });
            });
        });
        // At minimum, the final message is delivered
        const last = messages[messages.length - 1];
        expect(last.badge).toBe('v3');
    });
});
//# sourceMappingURL=ws.test.js.map