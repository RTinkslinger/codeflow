import type { IR } from './types.js';
export interface ExtractorOptions {
    path: string;
    root: string;
    timeoutMs?: number;
}
export interface ExtractorResult {
    ir: IR;
    stderrTail?: string;
    durationMs: number;
    workspaceErrors?: Array<{
        workspace: unknown;
        error: unknown;
    }>;
}
export interface Extractor {
    readonly name: string;
    readonly version: string;
    extract(opts: ExtractorOptions): Promise<ExtractorResult>;
}
//# sourceMappingURL=extractor.d.ts.map