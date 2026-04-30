/**
 * Walks up from `startPath` looking for the nearest workspace manifest.
 * Used by `mcp.ts.startPreview` to canonicalize the share-per-path key, so two
 * `start_preview` calls in nested directories of the same monorepo collapse to
 * a single preview (eng-lead review I7).
 *
 * Stops walking at:
 * - A directory containing `.git` (project boundary)
 * - Filesystem root
 */
export declare function resolveCanonicalRoot(startPath: string): Promise<string>;
//# sourceMappingURL=canonical-root.d.ts.map