import path from 'node:path';
import fs from 'node:fs/promises';
import { canonicalizePath } from './canonicalizer.js';
const MANIFEST_FILES = ['pnpm-workspace.yaml', 'package.json', 'pyproject.toml'];
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
export async function resolveCanonicalRoot(startPath) {
    const start = canonicalizePath(startPath);
    let dir = start;
    while (true) {
        for (const m of MANIFEST_FILES) {
            const p = path.join(dir, m);
            try {
                if (m === 'package.json') {
                    const content = JSON.parse(await fs.readFile(p, 'utf-8'));
                    if (content.workspaces)
                        return dir;
                }
                else if (m === 'pyproject.toml') {
                    const content = await fs.readFile(p, 'utf-8');
                    if (content.includes('[tool.uv.workspace]') ||
                        content.includes('[tool.pdm.workspace]') ||
                        content.includes('[tool.rye.workspaces]'))
                        return dir;
                }
                else {
                    await fs.access(p);
                    return dir;
                }
            }
            catch { /* not present or unreadable; try next manifest */ }
        }
        // .git boundary: if THIS dir contains .git, stop and fall through to "no match"
        try {
            await fs.access(path.join(dir, '.git'));
            return start; // hit project boundary without finding workspace manifest
        }
        catch { /* no .git here; continue up */ }
        const parent = path.dirname(dir);
        if (parent === dir)
            return start; // filesystem root
        dir = parent;
    }
}
//# sourceMappingURL=canonical-root.js.map