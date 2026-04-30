import { execFileSync, spawn } from 'node:child_process';
import { cpus } from 'node:os';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { runPerWorkspace } from '@codeflow/core';
import { canonicalizePath, posixRelative, detectWorkspaces, reRootIR } from '@codeflow/canonical';
/**
 * Extract a human-readable name from a SCIP symbol descriptor.
 *
 * SCIP format: `<scheme> <manager> <pkg-name> <pkg-version> <descriptor>`
 * Descriptor: chain of `<name>(<disambiguator>)<suffix>` separated by `/`.
 * Suffixes: `.` (term), `#` (type), `()` (method), `:` (type-param), `[]` (alias).
 *
 * Strategy: take the last non-empty descriptor segment, strip terminal SCIP
 * suffix punctuation. Falls back to filename for module-level symbols, then
 * to the raw symId.
 */
function extractSymbolName(symId) {
    // Split by space; first 4 tokens are scheme + 3-part package-id
    // Descriptor is everything after that. But package fields may contain spaces
    // when escaped — codeflow's fixtures don't hit that so we use a simple split.
    const parts = symId.split(' ');
    if (parts.length < 5)
        return symId; // malformed — use raw id
    const descriptor = parts.slice(4).join(' ');
    // Descriptor uses backticks around path-like segments (e.g. `index.ts`).
    // Strip all backticks for cleaner output.
    const noBackticks = descriptor.replace(/`/g, '');
    // Split on / — take the last non-empty segment
    const segments = noBackticks.split('/').filter(s => s.length > 0);
    if (segments.length === 0)
        return symId;
    let last = segments[segments.length - 1];
    // Strip terminal SCIP suffix punctuation first (`.` term, `#` type, `()` method, `:` type-param)
    // Order matters: strip trailing `().` or `()` before stripping lone `#` or `.`
    last = last.replace(/\(\)\.$/, ''); // method term: `foo().` → `foo`
    last = last.replace(/\(\)$/, ''); // method: `foo()` → `foo`
    last = last.replace(/[.#:[\]]+$/, ''); // remaining terminal markers
    // Within a segment, `#` separates class from member (e.g. `Greeter#greet`).
    // Take the part after the last `#` when present — that's the member name.
    // If the result is empty (bare `Greeter#`), keep the part before.
    if (last.includes('#')) {
        const afterHash = last.split('#').at(-1) ?? '';
        last = afterHash.length > 0 ? afterHash : (last.split('#')[0] ?? last);
    }
    // For parameter disambiguators like `greet.(self)` — strip trailing `(anything)`
    last = last.replace(/\([^)]*\)$/, '');
    return last || symId;
}
function emptyIR(name, version, invocationPath, root, partial = false) {
    return {
        schemaVersion: '1',
        meta: { extractor: { name, version, invocation: invocationPath }, root, ...(partial ? { partial: true } : {}) },
        documents: [],
        symbols: [],
        relationships: [],
    };
}
export class ScipTypescriptExtractor {
    name = 'scip-typescript';
    version = 'external';
    async extract(opts) {
        const start = Date.now();
        const root = canonicalizePath(opts.root);
        const allWorkspaces = await detectWorkspaces(opts.path, 'ts');
        const workspaces = allWorkspaces.filter(w => w.isLeaf);
        if (workspaces.length === 0) {
            return {
                ir: emptyIR(this.name, this.version, '', root, true),
                durationMs: Date.now() - start,
                workspaceErrors: [],
            };
        }
        const concurrency = Math.min(4, cpus().length);
        const { results, errors, cancelled } = await runPerWorkspace(workspaces, (w, signal) => this.runScipForWorkspace(w, signal), { concurrency, timeoutMs: opts.timeoutMs ?? 90_000, laneBudgetMs: 300_000 });
        // Re-root each per-workspace IR to repo-root and stamp workspaceRel
        const reRooted = results.map(r => reRootIR(r.ir, root, r.workspace.workspaceRel));
        // Build the per-workspace meta map
        const workspacesMeta = {};
        for (const w of workspaces) {
            workspacesMeta[w.workspaceRel] = { displayName: w.displayName, manifest: w.manifest };
        }
        // Concatenate IRs (canonical merge happens later in mcp.ts via canonicalMerge)
        const isPartial = errors.length > 0 || cancelled;
        const concatenated = {
            schemaVersion: '1',
            meta: {
                extractor: { name: this.name, version: this.version, invocation: `scip-typescript fan-out ${opts.path}` },
                root,
                ...(isPartial ? { partial: true } : {}),
                workspaces: workspacesMeta,
            },
            documents: reRooted.flatMap(ir => ir.documents),
            symbols: reRooted.flatMap(ir => ir.symbols),
            relationships: reRooted.flatMap(ir => ir.relationships),
        };
        return {
            ir: concatenated,
            durationMs: Date.now() - start,
            workspaceErrors: errors,
        };
    }
    async runScipForWorkspace(w, signal) {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow-scip-ts-'));
        const outFile = path.join(outDir, 'index.scip');
        const child = spawn('scip-typescript', ['index', '--output', outFile, w.workspacePath], {
            cwd: w.workspacePath,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        child.stderr?.on('data', (d) => { stderr += String(d).slice(-2000); });
        const onAbort = () => {
            child.kill('SIGTERM');
            setTimeout(() => {
                try {
                    child.kill('SIGKILL');
                }
                catch { /* already exited */ }
            }, 2_000);
        };
        signal.addEventListener('abort', onAbort);
        try {
            await new Promise((resolve, reject) => {
                child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`scip-typescript exited ${code}: ${stderr.slice(-500)}`)));
                child.on('error', reject);
            });
            const ir = parseSCIPOutput(outFile, w.workspacePath, this.name, this.version, `scip-typescript index ${w.workspacePath}`);
            return { ir, workspace: w };
        }
        finally {
            signal.removeEventListener('abort', onAbort);
            try {
                fs.rmSync(outDir, { recursive: true, force: true });
            }
            catch { /* tmp dir cleanup */ }
        }
    }
}
function parseSCIPOutput(scipFile, root, extractorName, extractorVersion, invocation) {
    let jsonStr;
    try {
        jsonStr = execFileSync('scip', ['print', '--json', scipFile], { encoding: 'utf-8', timeout: 30_000 });
    }
    catch {
        return emptyIR(extractorName, extractorVersion, invocation, root, true);
    }
    // scip print --json may output a banner line before the JSON; find the first '{'
    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart < 0)
        return emptyIR(extractorName, extractorVersion, invocation, root, true);
    const scip = JSON.parse(jsonStr.slice(jsonStart));
    const symbols = [];
    const relationships = [];
    const documents = [];
    const seenSymbolIds = new Set();
    const fileSymbolsByPath = new Map(); // canonAbsPath → file-symbol
    const docs = scip['documents'] ?? [];
    for (const doc of docs) {
        const relPath = doc['relative_path'];
        if (!relPath)
            continue;
        const absPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
        const canonAbs = canonicalizePath(absPath);
        let canonRel;
        try {
            canonRel = posixRelative(root, canonAbs);
        }
        catch {
            continue;
        }
        documents.push({ relPath: canonRel, absPath: canonAbs, language: 'ts' });
        // Synthesize a file-symbol for this document — used as the `from` endpoint
        // of relationships emitted in Task 4. ID is deterministic and content-free
        // (file::<absPath>) so the merger's byId remap can canonicalize it.
        const fileSymId = `file::${canonAbs}`;
        if (!fileSymbolsByPath.has(canonAbs)) {
            const fileSym = {
                id: fileSymId,
                kind: 'file',
                name: path.basename(canonAbs),
                absPath: canonAbs,
                relPath: canonRel,
                language: 'ts',
                origin: 'extractor',
                confidence: 'verified',
            };
            fileSymbolsByPath.set(canonAbs, fileSym);
            symbols.push(fileSym);
        }
        const occurrences = doc['occurrences'] ?? [];
        for (const occ of occurrences) {
            const symId = occ['symbol'];
            const rolesRaw = occ['symbol_roles'];
            if (!symId)
                continue;
            const roles = rolesRaw ?? 0; // SCIP emits 0 for plain references — treat undefined as 0
            // Definition role: bit 0 (0x1)
            if ((roles & 1) !== 0) {
                // SCIP can emit the same Definition occurrence multiple times (re-declarations, overloads).
                // Dedup by symId — IDs are SCIP symbol strings which are inherently unique per definition.
                if (seenSymbolIds.has(symId))
                    continue;
                seenSymbolIds.add(symId);
                const name = extractSymbolName(symId);
                symbols.push({ id: symId, kind: 'function', name, absPath: canonAbs, relPath: canonRel, language: 'ts', origin: 'extractor', confidence: 'verified' });
                continue;
            }
            // Skip local symbols (intra-document references not interesting for cross-file graph)
            if (symId.startsWith('local '))
                continue;
            // Import role: bit 1 (0x2) — defensive branch for scip-python / future scip-typescript versions
            if ((roles & 2) !== 0) {
                relationships.push({
                    id: `${fileSymId}::${symId}::imports`,
                    from: fileSymId,
                    to: symId,
                    kind: 'imports',
                    language: 'ts',
                    confidence: 'verified',
                });
                continue;
            }
            // Plain reference: roles === 0, non-local symbol — primary path on scip-typescript output
            if (roles === 0) {
                relationships.push({
                    id: `${fileSymId}::${symId}::references`,
                    from: fileSymId,
                    to: symId,
                    kind: 'references',
                    language: 'ts',
                    confidence: 'verified',
                });
            }
        }
    }
    return { schemaVersion: '1', meta: { extractor: { name: extractorName, version: extractorVersion, invocation }, root }, documents, symbols, relationships };
}
//# sourceMappingURL=index.js.map