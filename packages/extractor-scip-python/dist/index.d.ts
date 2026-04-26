import type { Extractor, ExtractorOptions, ExtractorResult } from '@codeflow/core';
export declare class ScipPythonExtractor implements Extractor {
    readonly name = "scip-python";
    readonly version = "external";
    extract(opts: ExtractorOptions): Promise<ExtractorResult>;
}
//# sourceMappingURL=index.d.ts.map