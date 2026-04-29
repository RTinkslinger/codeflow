import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { canonicalizePath, posixRelative } from '@codeflow/canonical';
const execFileAsync = promisify(execFile);
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
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow-scip-ts-'));
        const outFile = path.join(outDir, 'index.scip');
        const invocation = `scip-typescript index ${opts.path}`;
        let stderrTail;
        try {
            const result = await execFileAsync('scip-typescript', ['index', '--output', outFile, opts.path], { cwd: root, timeout: opts.timeoutMs ?? 90_000 });
            if (result.stderr)
                stderrTail = result.stderr.slice(-2000);
        }
        catch (err) {
            const e = err;
            stderrTail = e.stderr?.slice(-2000) ?? e.message;
            fs.rmSync(outDir, { recursive: true, force: true });
            const result = { ir: emptyIR(this.name, this.version, invocation, root, true), durationMs: Date.now() - start };
            if (stderrTail !== undefined)
                result.stderrTail = stderrTail;
            return result;
        }
        const ir = parseSCIPOutput(outFile, root, this.name, this.version, invocation);
        fs.rmSync(outDir, { recursive: true, force: true });
        const result = { ir, durationMs: Date.now() - start };
        if (stderrTail !== undefined)
            result.stderrTail = stderrTail;
        return result;
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
                const name = symId.split(':').at(-1) ?? symId;
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