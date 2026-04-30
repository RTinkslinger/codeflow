import { z } from 'zod';
export declare const ERROR_CATEGORIES: readonly ["setup", "dependency", "extraction", "timeout", "invariant", "input", "filesystem", "upstream", "runtime"];
export type ErrorCategory = typeof ERROR_CATEGORIES[number];
export type ErrorSeverity = 'fatal' | 'partial' | 'warning';
export declare const CodeflowErrorSchema: z.ZodObject<{
    code: z.ZodString;
    category: z.ZodEnum<{
        input: "input";
        setup: "setup";
        dependency: "dependency";
        extraction: "extraction";
        timeout: "timeout";
        invariant: "invariant";
        filesystem: "filesystem";
        upstream: "upstream";
        runtime: "runtime";
    }>;
    severity: z.ZodEnum<{
        fatal: "fatal";
        partial: "partial";
        warning: "warning";
    }>;
    title: z.ZodString;
    detail: z.ZodString;
    nextStep: z.ZodString;
    context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    diagId: z.ZodString;
    timestamp: z.ZodString;
    docsUrl: z.ZodString;
}, z.core.$strip>;
export type CodeflowError = z.infer<typeof CodeflowErrorSchema>;
interface CreateErrorOpts {
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    title: string;
    detail: string;
    nextStep: string;
    context: Record<string, unknown>;
}
export declare function createError(opts: CreateErrorOpts): CodeflowError;
export {};
//# sourceMappingURL=errors.d.ts.map