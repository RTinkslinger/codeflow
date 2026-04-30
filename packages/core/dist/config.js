import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
const ConfigSchema = z.object({
    logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    previewCap: z.number().int().min(1).max(32).default(8),
    idleTimeoutMs: z.number().int().default(600_000),
    subprocessTimeoutMs: z.number().int().default(90_000),
    watcherDebounceMs: z.number().int().default(200),
    requireManualApply: z.boolean().default(false),
    portRangeStart: z.number().int().default(7800),
    portRangeEnd: z.number().int().default(7900),
}).strict().refine(c => c.portRangeStart < c.portRangeEnd, {
    message: 'portRangeStart must be less than portRangeEnd',
    path: ['portRangeStart'],
});
export const defaultConfig = ConfigSchema.parse({});
export function loadConfig(searchFrom) {
    const candidates = [
        path.join(searchFrom, '.codeflow.json'),
        path.join(searchFrom, 'codeflow.config.json'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            let raw;
            try {
                raw = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
            }
            catch (e) {
                throw new Error(`Failed to parse config file ${candidate}: ${e instanceof Error ? e.message : String(e)}`);
            }
            return ConfigSchema.parse({ ...defaultConfig, ...raw });
        }
    }
    return defaultConfig;
}
//# sourceMappingURL=config.js.map