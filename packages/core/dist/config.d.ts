import { z } from 'zod';
declare const ConfigSchema: z.ZodObject<{
    logLevel: z.ZodDefault<z.ZodEnum<{
        fatal: "fatal";
        error: "error";
        warn: "warn";
        info: "info";
        debug: "debug";
        trace: "trace";
    }>>;
    previewCap: z.ZodDefault<z.ZodNumber>;
    idleTimeoutMs: z.ZodDefault<z.ZodNumber>;
    subprocessTimeoutMs: z.ZodDefault<z.ZodNumber>;
    watcherDebounceMs: z.ZodDefault<z.ZodNumber>;
    requireManualApply: z.ZodDefault<z.ZodBoolean>;
    portRangeStart: z.ZodDefault<z.ZodNumber>;
    portRangeEnd: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export type CodeflowConfig = z.infer<typeof ConfigSchema>;
export declare const defaultConfig: CodeflowConfig;
export declare function loadConfig(searchFrom: string): CodeflowConfig;
export {};
//# sourceMappingURL=config.d.ts.map