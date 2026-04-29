import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { canonicalizePath, posixRelative } from '@codeflow/canonical';
const execFileAsync = promisify(execFile);
function emptyIR(name, version, invocation, root, partial = false) {
    return {
        schemaVersion: '1',
        meta: { extractor: { name, version, invocation }, root, ...(partial ? { partial: true } : {}) },
        documents: [],
        symbols: [],
        relationships: [],
    };
}
export class ScipPythonExtractor {
    name = 'scip-python';
    version = 'external';
    async extract(opts) {
        const start = Date.now();
        const root = canonicalizePath(opts.root);
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow-scip-py-'));
        const outFile = path.join(outDir, 'index.scip');
        const invocation = `scip-python index ${opts.path}`;
        let stderrTail;
        try {
            const result = await execFileAsync('scip-python', ['index', '--output', outFile, '--project-root', root], { cwd: root, timeout: opts.timeoutMs ?? 90_000 });
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
        const ir = parseSCIPOutputPy(outFile, root, this.name, this.version, invocation);
        fs.rmSync(outDir, { recursive: true, force: true });
        const result = { ir, durationMs: Date.now() - start };
        if (stderrTail !== undefined)
            result.stderrTail = stderrTail;
        return result;
    }
}
function parseSCIPOutputPy(scipFile, root, extractorName, extractorVersion, invocation) {
    let jsonStr;
    try {
        jsonStr = execFileSync('scip', ['print', '--json', scipFile], { encoding: 'utf-8', timeout: 30_000 });
    }
    catch {
        return emptyIR(extractorName, extractorVersion, invocation, root, true);
    }
    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart < 0)
        return emptyIR(extractorName, extractorVersion, invocation, root, true);
    const scip = JSON.parse(jsonStr.slice(jsonStart));
    const symbols = [];
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
        const occurrences = doc['occurrences'] ?? [];
        for (const occ of occurrences) {
            const symId = occ['symbol'];
            const roles = occ['symbol_roles'];
            // bit 0 = Definition role in SCIP protobuf
            if (!symId || !roles || (roles & 1) === 0)
                continue;
            const name = symId.split(':').at(-1) ?? symId;
            symbols.push({ id: symId, kind: 'function', name, absPath: canonAbs, relPath: canonRel, language: 'py', origin: 'extractor', confidence: 'verified' });
        }
    }
    return { schemaVersion: '1', meta: { extractor: { name: extractorName, version: extractorVersion, invocation }, root }, documents: [], symbols, relationships: [] };
}
//# sourceMappingURL=index.js.map