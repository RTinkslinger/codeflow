import { describe, it, expect } from 'vitest';
import { renderMermaid } from './index.js';
import { mockExtractorOutput } from '@codeflow/test-utils';
describe('renderMermaid', () => {
    it('defaults to LR direction', () => {
        const ir = mockExtractorOutput({ symbolCount: 1 });
        const out = renderMermaid(ir);
        expect(out).toMatch(/^graph LR/);
    });
    it('produces valid mermaid graph header', () => {
        const ir = mockExtractorOutput({ symbolCount: 2 });
        ir.relationships = [{ id: 'r1', from: ir.symbols[0].id, to: ir.symbols[1].id, kind: 'imports', language: 'ts', confidence: 'inferred' }];
        const out = renderMermaid(ir, 'TD');
        expect(out).toMatch(/^graph TD/);
    });
    it('renders inferred edges as dashed', () => {
        const ir = mockExtractorOutput({ symbolCount: 2 });
        ir.relationships = [{ id: 'r1', from: ir.symbols[0].id, to: ir.symbols[1].id, kind: 'imports', language: 'ts', confidence: 'inferred' }];
        const out = renderMermaid(ir);
        expect(out).toContain('-.->'); // mermaid dashed arrow
    });
    it('renders verified edges as solid', () => {
        const ir = mockExtractorOutput({ symbolCount: 2 });
        ir.relationships = [{ id: 'r1', from: ir.symbols[0].id, to: ir.symbols[1].id, kind: 'imports', language: 'ts', confidence: 'verified' }];
        const out = renderMermaid(ir);
        expect(out).toContain('-->');
        expect(out).not.toContain('-.->'); // not dashed
    });
    it('returns empty graph for empty IR', () => {
        const ir = mockExtractorOutput({ symbolCount: 0 });
        const out = renderMermaid(ir);
        expect(out).toMatch(/^graph/);
        expect(out.split('\n').length).toBeLessThan(5);
    });
    it('sanitizes double-quotes in node labels', () => {
        const ir = mockExtractorOutput({ symbolCount: 1 });
        ir.symbols[0].name = 'AuthService["admin"]';
        const out = renderMermaid(ir);
        expect(out).not.toContain('"AuthService["');
        expect(out).toContain('&quot;');
    });
    it('sanitizes double-quotes in edge labels', () => {
        const ir = mockExtractorOutput({ symbolCount: 2 });
        ir.relationships = [{
                id: 'r1', from: ir.symbols[0].id, to: ir.symbols[1].id,
                kind: 'imports', language: 'ts', confidence: 'inferred',
                viz: { label: 'foo" | "bar' },
            }];
        const out = renderMermaid(ir);
        expect(out).not.toMatch(/\|"foo" \|/);
        expect(out).toContain('&quot;');
    });
    it('escapes HTML-significant chars in labels (Mermaid htmlLabels)', () => {
        const ir = mockExtractorOutput({ symbolCount: 0 });
        ir.symbols = [
            { id: 's1', kind: 'method', name: '<constructor>', absPath: '/p/x.ts', relPath: 'x.ts', language: 'ts', origin: 'extractor', confidence: 'verified' },
            { id: 's2', kind: 'class', name: 'Foo<T>', absPath: '/p/y.ts', relPath: 'y.ts', language: 'ts', origin: 'extractor', confidence: 'verified' },
            { id: 's3', kind: 'function', name: 'a&b', absPath: '/p/z.ts', relPath: 'z.ts', language: 'ts', origin: 'extractor', confidence: 'verified' },
        ];
        const out = renderMermaid(ir);
        expect(out).toContain('&lt;constructor&gt;');
        expect(out).toContain('Foo&lt;T&gt;');
        expect(out).toContain('a&amp;b');
        // Raw < and > must NOT appear in any label slot — they would silently break Mermaid's parser
        expect(out).not.toMatch(/\["[^"]*<[^"]*"\]/);
        expect(out).not.toMatch(/\["[^"]*>[^"]*"\]/);
    });
    it('disambiguates safeId collisions from truncation', () => {
        const ir = mockExtractorOutput({ symbolCount: 0 });
        // Two IDs that share the same 60-char prefix after sanitization
        const prefix = 'a'.repeat(60);
        ir.symbols = [
            { id: `${prefix}X`, kind: 'module', name: 'A', absPath: '/p/a.ts', relPath: 'a.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' },
            { id: `${prefix}Y`, kind: 'module', name: 'B', absPath: '/p/b.ts', relPath: 'b.ts', language: 'ts', origin: 'extractor', confidence: 'inferred' },
        ];
        const out = renderMermaid(ir);
        const nodeLines = out.split('\n').filter(l => l.includes('["'));
        // Each symbol must produce a unique node ID
        const ids = nodeLines.map(l => l.trim().split('[')[0].trim());
        expect(new Set(ids).size).toBe(2);
    });
});
//# sourceMappingURL=index.test.js.map