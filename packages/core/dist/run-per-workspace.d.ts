/**
 * Workspace-shaped object for runPerWorkspace.
 *
 * Duck-typed against `@codeflow/canonical`'s `Workspace` to avoid a circular
 * dependency (`canonical` already imports `core`).
 */
export interface WorkspaceLike {
    workspaceRel: string;
    workspacePath: string;
}
export interface RunPerWorkspaceOpts {
    concurrency: number;
    /** Per-item timeout in ms — fires the per-item AbortSignal */
    timeoutMs: number;
    /** Global lane budget in ms — fires AbortSignal on all in-flight items */
    laneBudgetMs: number;
}
export interface WorkspaceErrorInfo {
    workspace: WorkspaceLike;
    /** Error envelope — kept as `unknown` to avoid circular imports */
    error: unknown;
}
export interface RunPerWorkspaceResult<T> {
    results: T[];
    errors: WorkspaceErrorInfo[];
    /** True if the lane budget exhausted before all items completed */
    cancelled: boolean;
}
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
export declare function runPerWorkspace<T>(items: readonly WorkspaceLike[], fn: (w: WorkspaceLike, signal: AbortSignal) => Promise<T>, opts: RunPerWorkspaceOpts): Promise<RunPerWorkspaceResult<T>>;
//# sourceMappingURL=run-per-workspace.d.ts.map