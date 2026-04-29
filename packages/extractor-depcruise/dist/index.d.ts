import type { Extractor, ExtractorOptions, ExtractorResult } from '@codeflow/core';
export declare class DepcruiseExtractor implements Extractor {
    readonly name = "depcruise";
    readonly version = "16.x";
    extract(opts: ExtractorOptions): Promise<ExtractorResult>;
}
//# sourceMappingURL=index.d.ts.map