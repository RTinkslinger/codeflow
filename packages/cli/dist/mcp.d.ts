import type { PreviewStatus } from './state.js';
import type { IR } from '@codeflow/core';
export declare class CodeflowMCP {
    private previews;
    private fastExtractor;
    private pyExtractor;
    private scipTsExtractor;
    private scipPyExtractor;
    startPreview(opts: {
        path: string;
        verified?: boolean;
    }): Promise<{
        url: string;
        previewId: string;
        status: PreviewStatus;
    }>;
    private runFastExtraction;
    private runVerifiedExtraction;
    listPreviews(): Promise<Array<{
        previewId: string;
        path: string;
        url: string;
        status: PreviewStatus;
        lastClientSeen: number;
        lastGetIrSeen: number;
        lastError?: unknown;
    }>>;
    stopPreview(opts: {
        previewId: string;
    }): Promise<{
        stopped: boolean;
        finalStatus: PreviewStatus;
    }>;
    getIR(opts: {
        previewId: string;
        filter?: Record<string, unknown>;
    }): Promise<{
        ir: IR | null;
        status: PreviewStatus;
        truncated: boolean;
    }>;
    renderOnce(opts: {
        path: string;
        format?: string;
    }): Promise<{
        filePath: string;
    }>;
    private resetIdleTimer;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=mcp.d.ts.map