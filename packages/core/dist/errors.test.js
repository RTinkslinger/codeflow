import { describe, it, expect } from 'vitest';
import { createError, CodeflowErrorSchema } from './errors.js';
describe('createError', () => {
    it('builds a valid CodeflowError envelope', () => {
        const err = createError({
            code: 'EXTRACTOR_NOT_FOUND',
            category: 'dependency',
            severity: 'partial',
            title: 'Extractor not found',
            detail: 'dependency-cruiser is not on PATH',
            nextStep: 'Run: npm install -g dependency-cruiser',
            context: { tool: 'depcruise' },
        });
        expect(err.diagId).toBeTruthy();
        expect(err.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(err.docsUrl).toContain('EXTRACTOR_NOT_FOUND');
        const parsed = CodeflowErrorSchema.safeParse(err);
        expect(parsed.success).toBe(true);
    });
    it('generates unique diagId for each call', () => {
        const a = createError({ code: 'X', category: 'runtime', severity: 'warning', title: 'X', detail: 'X', nextStep: 'X', context: {} });
        const b = createError({ code: 'X', category: 'runtime', severity: 'warning', title: 'X', detail: 'X', nextStep: 'X', context: {} });
        expect(a.diagId).not.toBe(b.diagId);
    });
});
//# sourceMappingURL=errors.test.js.map