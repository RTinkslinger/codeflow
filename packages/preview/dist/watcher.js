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