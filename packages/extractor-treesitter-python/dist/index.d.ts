import type { Extractor, ExtractorOptions, ExtractorResult } from '@codeflow/core';
export declare class TreeSitterPythonExtractor implements Extractor {
    readonly name = "tree-sitter-python";
    readonly version = "0.23.x";
    extract(opts: ExtractorOptions): Promise<ExtractorResult>;
}
//# sourceMappingURL=index.d.ts.map