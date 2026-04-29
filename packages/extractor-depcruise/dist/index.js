import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizePath, posixRelative, buildDescriptor } from '@codeflow/canonical';
const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * Locate the depcruise binary. With pnpm workspaces, `pnpm --filter <pkg> add`
 * installs binaries into the package-local node_modules/.bin first.
 * Walk from __dirname (which is packages/extractor-depcruise/src at dev time
 * or packages/extractor-depcruise/dist at runtime) up to workspace root.
 */
function findDepcruiseBin() {
    const candidates = [
        path.resolve(__dirname, '../node_modules/.bin/depcruise'), // package-local (pnpm installs here)
        path.resolve(__dirname, '../../../node_modules/.bin/depcruise'), // workspace root
        'depcruise', // PATH fallback
    ];
    for (const c of candidates) {
        if (c === 'depcruise')
            return c; // always accept PATH fallback last
        if (fs.existsSync(c))
            return c;
    }
    return 'depcruise';
}
const DEPCRUISE_BIN = findDepcruiseBin();
export class DepcruiseExtractor {
    name = 'depcruise';
    version = '16.x';
    async extract(opts) {
        const start = Date.now();
        const root = canonicalizePath(opts.root);
        let stdout;
        let stderrTail;
        try {
            const result = await execFileAsync(DEPCRUISE_BIN, ['--no-config', '--exclude', '(^|/)(node_modules|\\.git)(/|$)', '--output-type', 'json', root], { cwd: root, timeout: opts.timeoutMs ?? 90_000, maxBuffer: 50 * 1024 * 1024 });
            stdout = result.stdout;
            if (result.stderr)
                stderrTail = result.stderr.slice(-2000);
        }
        catch (err) {
            const e = err;
            stdout = e.stdout || '{}';
            stderrTail = e.stderr?.slice(-2000) ?? e.message;
        }
        // depcruise may emit a banner before JSON; find the first '{' to extract clean JSON
        const jsonStart = stdout.indexOf('{');
        const jsonStr = jsonStart >= 0 ? stdout.slice(jsonStart) : '{}';
        const parsed = JSON.parse(jsonStr);
        const symbols = [];
        const relationships = [];
        for (const mod of parsed.modules ?? []) {
            if (mod.coreModule || mod.couldNotResolve)
                continue;
            const absPath = path.isAbsolute(mod.source)
                ? mod.source
                : path.join(root, mod.source);
            const canonAbs = canonicalizePath(absPath);
            let relPath;
            try {
                relPath = posixRelative(root, canonAbs);
            }
            catch {
                continue;
            }
            const id = buildDescriptor({
                scheme: 'depcruise',
                manager: 'node',
                pkg: relPath,
                descriptor: path.basename(relPath),
            });
            symbols.push({
                id,
                kind: 'module',
                name: path.basename(relPath),
                absPath: canonAbs,
                relPath,
                language: 'ts',
                origin: 'extractor',
                confidence: 'inferred',
            });
            for (const dep of mod.dependencies) {
                // Skip unresolvable deps (e.g. node builtins, missing packages)
                if (!dep.resolved || dep.couldNotResolve)
                    continue;
                const depAbs = path.isAbsolute(dep.resolved)
                    ? dep.resolved
                    : path.join(root, dep.resolved);
                const depCanon = canonicalizePath(depAbs);
                let depRel;
                try {
                    depRel = posixRelative(root, depCanon);
                }
                catch {
                    continue;
                }
                const toId = buildDescriptor({
                    scheme: 'depcruise',
                    manager: 'node',
                    pkg: depRel,
                    descriptor: path.basename(depRel),
                });
                relationships.push({
                    id: `${id}::${toId}::imports`,
                    from: id,
                    to: toId,
                    kind: 'imports',
                    language: 'ts',
                    confidence: 'inferred',
                });
            }
        }
        const ir = {
            schemaVersion: '1',
            meta: {
                extractor: { name: this.name, version: this.version, invocation: `depcruise ${opts.path}` },
                root,
            },
            documents: symbols.map(s => ({ relPath: s.relPath, absPath: s.absPath, language: s.language })),
            symbols,
            relationships,
        };
        // exactOptionalPropertyTypes: only include stderrTail when it has a value
        const result = { ir, durationMs: Date.now() - start };
        if (stderrTail !== undefined)
            result.stderrTail = stderrTail;
        return result;
    }
}
//# sourceMappingURL=index.js.map