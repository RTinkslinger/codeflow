import chokidar from 'chokidar';
const IGNORED = [
    '**/node_modules/**', '**/.git/**', '**/.venv/**', '**/venv/**',
    '**/dist/**', '**/build/**', '**/.next/**', '**/.parcel-cache/**', '**/target/**',
];
export class FileWatcher {
    watcher = null;
    start(watchPath, onChange) {
        this.watcher = chokidar.watch(watchPath, {
            ignored: IGNORED,
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
            usePolling: false,
            // pnpm workspaces use symlinks heavily; following them descends into
            // node_modules content already covered by direct package paths AND
            // explodes file-descriptor count on real monorepos. Off by default
            // in chokidar; setting explicitly to document intent.
            followSymlinks: false,
            // Cap recursion depth; defends against EMFILE on repos with deep
            // dist/cache trees that fall outside the IGNORED globs.
            depth: 10,
        });
        let debounceTimer = null;
        const trigger = () => {
            if (debounceTimer)
                clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => { debounceTimer = null; onChange(); }, 200);
        };
        this.watcher.on('change', trigger).on('add', trigger).on('unlink', trigger);
    }
    async stop() {
        await this.watcher?.close();
        this.watcher = null;
    }
}
//# sourceMappingURL=watcher.js.map