export type WorkspaceManifest = 'pnpm' | 'pkgjson' | 'pyproject' | 'setup.py' | 'fs-fallback';
export type WorkspaceLanguage = 'ts' | 'py';
export interface DetectionWarning {
    code: 'SETUP_PY_NAME_UNRESOLVED';
    message: string;
}
export interface Workspace {
    /** Canonical repo root — same for all workspaces in a single detection result */
    rootPath: string;
    /** Absolute path to this workspace's directory */
    workspacePath: string;
    /** Posix-relative path from rootPath; e.g. "packages/cli", "apps/web" */
    workspaceRel: string;
    /** Source of detection */
    manifest: WorkspaceManifest;
    language: WorkspaceLanguage;
    /** Absolute path to the language config — tsconfig.json or pyproject.toml or setup.py */
    configPath: string;
    /** TS only: true if no other detected tsconfig references this workspace's tsconfig */
    isLeaf: boolean;
    /** Display label for renderers (from package.json `name`, pyproject `[project].name`, setup.py `name=`) */
    displayName: string;
    /** Non-fatal warnings discovered at detection time (e.g., setup.py name= not statically extractable) */
    detectionWarnings?: DetectionWarning[];
}
export interface WorkspaceErrorInfo {
    workspace: Workspace;
    /** Codeflow error envelope — keep as `unknown` here to avoid circular dep with @codeflow/core */
    error: unknown;
}
//# sourceMappingURL=workspace-types.d.ts.map