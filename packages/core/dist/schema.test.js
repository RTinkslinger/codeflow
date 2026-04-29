import { describe, it, expect } from 'vitest';
import { IRSchema, SymbolSchema, RelationshipSchema } from './schema.js';
describe('IRSchema', () => {
    it('parses a minimal valid IR', () => {
        const raw = {
            schemaVersion: '1',
            meta: { extractor: { name: 'test', version: '1.0.0', invocation: 'test .' }, root: '/project' },
            documents: [],
            symbols: [],
            relationships: [],
        };
        const result = IRSchema.safeParse(raw);
        expect(result.success).toBe(true);
    });
    it('rejects unknown schemaVersion', () => {
        const result = IRSchema.safeParse({ schemaVersion: '99', meta: {}, documents: [], symbols: [], relationships: [] });
        expect(result.success).toBe(false);
    });
    it('accepts valid symbol; language is a dedicated field, not embedded in id', () => {
        const sym = {
            id: 'tsc:typescript:src/auth:AuthService',
            kind: 'class',
            name: 'AuthService',
            absPath: '/project/src/auth.ts',
            relPath: 'src/auth.ts',
            language: 'ts',
            origin: 'extractor',
            confidence: 'verified',
        };
        const result = SymbolSchema.safeParse(sym);
        expect(result.success).toBe(true);
        if (result.success)
            expect(result.data.language).toBe('ts');
    });
    it('rejects symbol with unknown kind', () => {
        const result = SymbolSchema.safeParse({ id: 'x', kind: 'goblin', name: 'x', absPath: '/x', relPath: 'x', language: 'ts', origin: 'extractor', confidence: 'inferred' });
        expect(result.success).toBe(false);
    });
    it('rejects unknown fields on SymbolSchema', () => {
        const result = SymbolSchema.safeParse({
            id: 'tsc:typescript:src/auth:AuthService',
            kind: 'class',
            name: 'AuthService',
            absPath: '/project/src/auth.ts',
            relPath: 'src/auth.ts',
            language: 'ts',
            origin: 'extractor',
            confidence: 'verified',
            unknownField: 'should-be-rejected',
        });
        expect(result.success).toBe(false);
    });
});
describe('RelationshipSchema', () => {
    it('parses a valid relationship', () => {
        const result = RelationshipSchema.safeParse({
            id: 'rel:1',
            from: 'tsc:typescript:src/a:A',
            to: 'tsc:typescript:src/b:B',
            kind: 'imports',
            language: 'ts',
            confidence: 'verified',
        });
        expect(result.success).toBe(true);
    });
    it('rejects unknown relationship kind', () => {
        const result = RelationshipSchema.safeParse({
            id: 'rel:1',
            from: 'a',
            to: 'b',
            kind: 'depends_on',
            language: 'ts',
            confidence: 'inferred',
        });
        expect(result.success).toBe(false);
    });
    it('rejects unknown fields on RelationshipSchema', () => {
        const result = RelationshipSchema.safeParse({
            id: 'rel:1',
            from: 'a',
            to: 'b',
            kind: 'imports',
            language: 'ts',
            confidence: 'inferred',
            bogus: true,
        });
        expect(result.success).toBe(false);
    });
});
//# sourceMappingURL=schema.test.js.map