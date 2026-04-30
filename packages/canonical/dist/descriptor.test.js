import { describe, it, expect } from 'vitest';
import { buildDescriptor, parseDescriptor } from './descriptor.js';
describe('buildDescriptor', () => {
    it('produces scheme:manager:package:descriptor format', () => {
        const id = buildDescriptor({ scheme: 'tsc', manager: 'typescript', pkg: 'src/auth', descriptor: 'AuthService#login' });
        expect(id).toBe('tsc:typescript:src/auth:AuthService#login');
    });
    it('does NOT embed language in the id', () => {
        const id = buildDescriptor({ scheme: 'tsc', manager: 'typescript', pkg: 'src/auth', descriptor: 'AuthService' });
        expect(id).not.toMatch(/^ts:|^py:/);
        // language is a separate field on CFSymbol, not part of the id
    });
    it('round-trips through parseDescriptor', () => {
        const parts = { scheme: 'tsc', manager: 'typescript', pkg: 'src/utils', descriptor: 'helper' };
        const id = buildDescriptor(parts);
        expect(parseDescriptor(id)).toEqual(parts);
    });
    it('round-trips when descriptor contains embedded colons (e.g. method signature)', () => {
        const parts = { scheme: 'scip-py', manager: 'python', pkg: 'src/auth', descriptor: 'AuthService#login(string:int)' };
        const id = buildDescriptor(parts);
        expect(parseDescriptor(id)).toEqual(parts);
    });
});
describe('parseDescriptor', () => {
    it('throws on malformed descriptor', () => {
        expect(() => parseDescriptor('only-one-segment')).toThrow('Invalid Symbol.Descriptor');
    });
});
//# sourceMappingURL=descriptor.test.js.map