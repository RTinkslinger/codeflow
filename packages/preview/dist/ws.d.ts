import type http from 'node:http';
export interface BroadcastMessage {
    type: string;
    [key: string]: unknown;
}
export declare class WSBroadcaster {
    private wss;
    private latestPerClient;
    private lastMessage;
    constructor(server: http.Server);
    broadcast(msg: BroadcastMessage): void;
    close(): void;
}
//# sourceMappingURL=ws.d.ts.map