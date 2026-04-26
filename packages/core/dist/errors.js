import crypto from 'node:crypto';
import { z } from 'zod';
export const ERROR_CATEGORIES = ['setup', 'dependency', 'extraction', 'timeout', 'invariant', 'input', 'filesystem', 'upstream', 'runtime'];
export const CodeflowErrorSchema = z.object({
    code: z.string(),
    category: z.enum(ERROR_CATEGORIES),
    severity: z.enum(['fatal', 'partial', 'warning']),
    title: z.string(),
    detail: z.string(),
    nextStep: z.string(),
    context: z.record(z.string(), z.unknown()),
    diagId: z.string(),
    timestamp: z.string(),
    docsUrl: z.string(),
});
const DOCS_BASE = 'https://github.com/RTinkslinger/codeflow/blob/main/docs/errors';
export function createError(opts) {
    return {
        ...opts,
        diagId: crypto.randomUUID().slice(0, 8),
        timestamp: new Date().toISOString(),
        docsUrl: `${DOCS_BASE}/${opts.code}.md`,
    };
}
//# sourceMappingURL=errors.js.map