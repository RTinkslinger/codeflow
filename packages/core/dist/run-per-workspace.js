/**
 * Run `fn` per workspace with bounded concurrency, per-item timeout, and global lane budget.
 *
 * Consumer contract: if `fn` spawns a child process or other long-running operation,
 * it MUST honor the AbortSignal — otherwise zombie processes can outlive the budget.
 * Example:
 *
 *     const child = spawn(...)
 *     signal.addEventListener('abort', () => {
 *       child.kill('SIGTERM')
 *       setTimeout(() => child.kill('SIGKILL'), 2_000)
 *     })
 */
export async function runPerWorkspace(items, fn, opts) {
    const results = [];
    const errors = [];
    let cancelled = false;
    const laneController = new AbortController();
    const laneTimeout = setTimeout(() => laneController.abort(new Error('lane budget exhausted')), opts.laneBudgetMs);
    const queue = [...items];
    const workers = [];
    const workerCount = Math.min(opts.concurrency, items.length);
    for (let i = 0; i < workerCount; i++) {
        workers.push((async () => {
            while (queue.length > 0) {
                if (laneController.signal.aborted) {
                    cancelled = true;
                    // Drain remaining queue as errors
                    while (queue.length > 0) {
                        const ws = queue.shift();
                        errors.push({
                            workspace: ws,
                            error: { code: 'LANE_BUDGET_EXHAUSTED', message: 'cancelled before start' },
                        });
                    }
                    return;
                }
                const ws = queue.shift();
                const itemController = new AbortController();
                const itemTimeout = setTimeout(() => itemController.abort(new Error('per-item timeout')), opts.timeoutMs);
                // Combine: abort the per-item controller if the lane is aborted
                const onLaneAbort = () => itemController.abort(laneController.signal.reason);
                laneController.signal.addEventListener('abort', onLaneAbort);
                try {
                    const r = await fn(ws, itemController.signal);
                    results.push(r);
                }
                catch (e) {
                    errors.push({
                        workspace: ws,
                        error: { code: 'WORKSPACE_FN_FAILED', message: String(e) },
                    });
                    if (laneController.signal.aborted)
                        cancelled = true;
                }
                finally {
                    clearTimeout(itemTimeout);
                    laneController.signal.removeEventListener('abort', onLaneAbort);
                }
            }
        })());
    }
    await Promise.all(workers);
    clearTimeout(laneTimeout);
    return { results, errors, cancelled };
}
//# sourceMappingURL=run-per-workspace.js.map