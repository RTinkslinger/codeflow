import type { CodeflowError } from '@codeflow/core';
interface DoctorReport {
    node: string;
    os: string;
    platform: string;
    tools: Record<string, boolean>;
    recentErrors: string[];
}
export declare function runDoctor(): Promise<DoctorReport>;
interface BundleContents {
    error: CodeflowError;
    context: Record<string, unknown>;
    irPartial?: unknown;
    stderrTail?: string;
    logTail?: string;
}
export declare function saveDiagBundle(diagId: string, contents: BundleContents): Promise<string>;
export {};
//# sourceMappingURL=doctor.d.ts.map