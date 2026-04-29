import type { CFSymbol, Relationship } from '@codeflow/core';
interface MergeResult {
    symbols: CFSymbol[];
    relationships: Relationship[];
}
export declare function canonicalMerge(symbols: CFSymbol[], _root: string, relationships?: Relationship[]): MergeResult;
export {};
//# sourceMappingURL=merger.d.ts.map