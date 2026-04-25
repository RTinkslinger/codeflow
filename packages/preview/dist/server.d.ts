import http from 'node:http';
interface PortRange {
    start: number;
    end: number;
}
export declare function allocatePort(range: PortRange): Promise<number>;
export declare class PreviewServer {
    private httpServer;
    private _port;
    start(portRange?: PortRange): Promise<{
        port: number;
        url: string;
    }>;
    private tryBind;
    get server(): http.Server | null;
    get port(): number;
    stop(): Promise<void>;
}
export {};
//# sourceMappingURL=server.d.ts.map