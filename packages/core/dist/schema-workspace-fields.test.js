import { describe, it, expect } from 'vitest';
import { IRSchema, SymbolSchema } from './schema.js';
describe('schema — workspace fields (Task 18)', () => {
    it('SymbolSchema accepts optional workspaceRel', () => {
        const sym = {
            id: 's1',
            kind: 'function',
            name: 'foo',
            absPath: '/r/a.ts',
            relPath: 'a.ts',
            language: 'ts',
            origin: 'extractor',
            confidence: 'verified',
            workspaceRel: 'packages/cli',
        };
        expect(() => SymbolSchema.parse(sym)).not.toThrow();
    });
    it('SymbolSchema accepts symbols WITHOUT workspaceRel (backward compat)', () => {
        const sym = {
            id: 's1',
            kind: 'function',
            name: 'foo',
            absPath: '/r/a.ts',
            relPath: 'a.ts',
            language: 'ts',
            origin: 'extractor',
            confidence: 'verified',
        };
        expect(() => SymbolSchema.parse(sym)).not.toThrow();
    });
    it('IRSchema.meta accepts optional workspaces map', () => {
        const ir = {
            schemaVersion: '1',
            meta: {
                extractor: { name: 'x', version: '1', invocation: 'i' },
                root: '/r',
                workspaces: {
                    'packages/cli': { displayName: 'cli', manifest: 'pnpm' },
                    'packages/core': { displayName: 'core', manifest: 'pnpm' },
                },
            },
            documents: [],
            symbols: [],
            relationships: [],
        };
        expect(() => IRSchema.parse(ir)).not.toThrow();
    });
    it('IRSchema.meta workspaces rejects unknown manifest values (strict enum)', () => {
        const ir = {
            schemaVersion: '1',
            meta: {
                extractor: { name: 'x', version: '1', invocation: 'i' },
                root: '/r',
                workspaces: {
                    'packages/cli': { displayName: 'cli', manifest: 'unknown-manager' }, // invalid
                },
            },
            documents: [], symbols: [], relationships: [],
        };
        expect(() => IRSchema.parse(ir)).toThrow();
    });
    it('IRSchema accepts IR without workspace fields (backward compat)', () => {
        const ir = {
            schemaVersion: '1',
            meta: { extractor: { name: 'x', version: '1', invocation: 'i' }, root: '/r' },
            documents: [], symbols: [], relationships: [],
        };
        expect(() => IRSchema.parse(ir)).not.toThrow();
    });
});
//# sourceMappingURL=schema-workspace-fields.test.js.map