import { WebSocketServer, WebSocket } from 'ws';
export class WSBroadcaster {
    wss;
    latestPerClient = new WeakMap();
    lastMessage = null;
    constructor(server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });
        this.wss.on('connection', (ws) => {
            ws.on('error', () => ws.terminate());
            // Replay last state to late-connecting clients (fixes race: extraction finishes before browser opens)
            if (this.lastMessage && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(this.lastMessage));
            }
        });
    }
    broadcast(msg) {
        this.lastMessage = msg;
        const payload = JSON.stringify(msg);
        for (const client of this.wss.clients) {
            if (client.readyState !== WebSocket.OPEN)
                continue;
            const existing = this.latestPerClient.get(client);
            if (existing)
                clearTimeout(existing);
            // Latest-wins: defer send by one tick, replacing any pending send
            const timer = setTimeout(() => {
                if (client.readyState === WebSocket.OPEN)
                    client.send(payload);
                this.latestPerClient.delete(client);
            }, 0);
            this.latestPerClient.set(client, timer);
        }
    }
    close() {
        for (const client of this.wss.clients) {
            client.terminate();
        }
        this.wss.close();
    }
}
//# sourceMappingURL=ws.js.map