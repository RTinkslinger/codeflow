import crypto from 'node:crypto';
import { DepcruiseExtractor } from '@codeflow/extractor-depcruise';
import { TreeSitterPythonExtractor } from '@codeflow/extractor-treesitter-python';
import { ScipTypescriptExtractor } from '@codeflow/extractor-scip-typescript';
import { ScipPythonExtractor } from '@codeflow/extractor-scip-python';
import { renderMermaid } from '@codeflow/renderer-mermaid';
import { PreviewServer, WSBroadcaster, FileWatcher } from '@codeflow/preview';
import { mergeIRs, createError, computeDiff } from '@codeflow/core';
import { canonicalMerge } from '@codeflow/canonical';
import { LaneStateMachine, derivePreviewStatus } from './state.js';
const PREVIEW_CAP = 8;
const IDLE_TIMEOUT_MS = 600_000;
export class CodeflowMCP {
    previews = new Map();
    fastExtractor = new DepcruiseExtractor();
    pyExtractor = new TreeSitterPythonExtractor();
    scipTsExtractor = new ScipTypescriptExtractor();
    scipPyExtractor = new ScipPythonExtractor();
    async startPreview(opts) {
        // Return existing preview for same path (v1 share-per-path)
        for (const p of this.previews.values()) {
            if (p.path === opts.path)
                return { url: p.url, previewId: p.previewId, status: derivePreviewStatus([p.fastLane.state, p.verifiedLane.state]) };
        }
        if (this.previews.size >= PREVIEW_CAP) {
            throw new Error(`preview cap reached (${PREVIEW_CAP}). Call list_previews() and stop one before starting a new preview.`);
        }
        const previewId = crypto.randomUUID();
        const server = new PreviewServer();
        const { port, url } = await server.start();
        const broadcaster = new WSBroadcaster(server.server);
        const watcher = new FileWatcher();
        const fastLane = new LaneStateMachine();
        const verifiedLane = new LaneStateMachine();
        const record = {
            previewId, path: opts.path, url, port, server, broadcaster, watcher,
            fastLane, verifiedLane, fastIR: null, verifiedIR: null,
            lastClientSeen: Date.now(), lastGetIrSeen: Date.now(),
        };
        this.previews.set(previewId, record);
        // Start fast extraction in background (async-first)
        this.runFastExtraction(record);
        if (opts.verified)
            this.runVerifiedExtraction(record);
        // Set up file watcher
        watcher.start(opts.path, () => {
            this.runFastExtraction(record);
            if (opts.verified)
                this.runVerifiedExtraction(record);
        });
        // Idle GC
        this.resetIdleTimer(record);
        return { url, previewId, status: 'extracting' };
    }
    async runFastExtraction(record) {
        if (record.fastLane.state === 'aborted')
            return;
        record.fastLane.onSave();
        try {
            const [tsResult, pyResult] = await Promise.allSettled([
                this.fastExtractor.extract({ path: record.path, root: record.path }),
                this.pyExtractor.extract({ path: record.path, root: record.path }),
            ]);
            const irs = [];
            if (tsResult.status === 'fulfilled')
                irs.push(tsResult.value.ir);
            if (pyResult.status === 'fulfilled')
                irs.push(pyResult.value.ir);
            if (irs.length > 0) {
                const merged = mergeIRs(irs);
                const { symbols, relationships } = canonicalMerge(merged.symbols, record.path, merged.relationships);
                const canonical = { ...merged, symbols, relationships };
                record.fastIR = canonical;
                const mermaid = renderMermaid(canonical);
                record.broadcaster.broadcast({ type: 'update', mermaid, badge: '● fast view' });
                record.fastLane.onOk();
            }
            else {
                record.fastLane.onFail();
                const err = createError({ code: 'EMPTY_OUTPUT', category: 'extraction', severity: 'partial', title: 'No output from extractors', detail: 'All fast-lane extractors returned empty IR', nextStep: 'Check that the path contains .ts or .py files', context: { path: record.path } });
                record.lastError = err;
                record.broadcaster.broadcast({ type: 'error', error: err });
            }
        }
        catch (err) {
            record.fastLane.onFail();
            record.lastError = err;
            record.broadcaster.broadcast({ type: 'error', error: { code: 'EXTRACTION_EXCEPTION', detail: String(err) } });
        }
        this.resetIdleTimer(record);
    }
    async runVerifiedExtraction(record) {
        if (record.verifiedLane.state === 'aborted')
            return;
        record.verifiedLane.onSave();
        try {
            const [tsResult, pyResult] = await Promise.allSettled([
                this.scipTsExtractor.extract({ path: record.path, root: record.path }),
                this.scipPyExtractor.extract({ path: record.path, root: record.path }),
            ]);
            const irs = [];
            if (tsResult.status === 'fulfilled')
                irs.push(tsResult.value.ir);
            if (pyResult.status === 'fulfilled')
                irs.push(pyResult.value.ir);
            if (irs.some(ir => ir.symbols.length > 0)) {
                const merged = mergeIRs(irs);
                const { symbols, relationships } = canonicalMerge(merged.symbols, record.path, merged.relationships);
                const canonical = { ...merged, symbols, relationships };
                const diff = computeDiff(record.verifiedIR, canonical);
                canonical.meta.diff = diff;
                record.verifiedIR = canonical;
                const mermaid = renderMermaid(canonical);
                record.broadcaster.broadcast({ type: 'verified_ready', mermaid, badge: '● verified', diff });
                record.verifiedLane.onOk();
            }
            else {
                record.verifiedLane.onFail();
                // Lane-scoped: fast view survives — broadcast warning, not error
                record.broadcaster.broadcast({ type: 'update', mermaid: record.fastIR ? renderMermaid(record.fastIR) : 'graph LR', badge: '● fast view (verified failed)' });
            }
        }
        catch (err) {
            record.verifiedLane.onFail();
            record.lastError = err;
            record.broadcaster.broadcast({ type: 'update', mermaid: record.fastIR ? renderMermaid(record.fastIR) : 'graph LR', badge: '● fast view (verified failed)' });
        }
        this.resetIdleTimer(record);
    }
    async listPreviews() {
        return [...this.previews.values()].map(p => ({
            previewId: p.previewId, path: p.path, url: p.url,
            status: derivePreviewStatus([p.fastLane.state, p.verifiedLane.state]),
            lastClientSeen: p.lastClientSeen, lastGetIrSeen: p.lastGetIrSeen,
            lastError: p.lastError,
        }));
    }
    async stopPreview(opts) {
        const record = this.previews.get(opts.previewId);
        if (!record)
            return { stopped: false, finalStatus: 'aborted' };
        record.fastLane.onStop();
        record.verifiedLane.onStop();
        clearTimeout(record.idleTimer);
        await record.watcher.stop();
        record.broadcaster.close();
        await record.server.stop();
        this.previews.delete(opts.previewId);
        return { stopped: true, finalStatus: 'aborted' };
    }
    async getIR(opts) {
        const record = this.previews.get(opts.previewId);
        if (!record)
            return { ir: null, status: 'aborted', truncated: false };
        record.lastGetIrSeen = Date.now();
        this.resetIdleTimer(record);
        const status = derivePreviewStatus([record.fastLane.state, record.verifiedLane.state]);
        const ir = record.verifiedIR ?? record.fastIR;
        return { ir, status, truncated: false };
    }
    async renderOnce(opts) {
        const [tsResult, pyResult] = await Promise.allSettled([
            this.fastExtractor.extract({ path: opts.path, root: opts.path }),
            this.pyExtractor.extract({ path: opts.path, root: opts.path }),
        ]);
        const irs = [];
        if (tsResult.status === 'fulfilled')
            irs.push(tsResult.value.ir);
        if (pyResult.status === 'fulfilled')
            irs.push(pyResult.value.ir);
        const merged = mergeIRs(irs);
        const { symbols, relationships } = canonicalMerge(merged.symbols, opts.path, merged.relationships);
        const canonical = { ...merged, symbols, relationships };
        const mermaid = renderMermaid(canonical);
        const fs = await import('node:fs');
        const path = await import('node:path');
        const outPath = path.join(opts.path, 'codeflow-output.mmd');
        fs.writeFileSync(outPath, mermaid);
        return { filePath: outPath };
    }
    resetIdleTimer(record) {
        clearTimeout(record.idleTimer);
        record.idleTimer = setTimeout(() => {
            if (Date.now() - record.lastClientSeen > IDLE_TIMEOUT_MS && Date.now() - record.lastGetIrSeen > IDLE_TIMEOUT_MS) {
                this.stopPreview({ previewId: record.previewId });
            }
        }, IDLE_TIMEOUT_MS).unref();
    }
    async shutdown() {
        const ids = [...this.previews.keys()];
        for (const id of ids) {
            await this.stopPreview({ previewId: id });
        }
    }
}
//# sourceMappingURL=mcp.js.map