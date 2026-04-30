import type { IR, Relationship } from './types.js';
export declare function mergeIRs(irs: IR[]): IR;
export interface MergeDiff {
    added: Relationship[];
    removed: Relationship[];
    upgraded: Relationship[];
}
export declare function computeDiff(previous: IR | null, current: IR): MergeDiff;
//# sourceMappingURL=merger.d.ts.map