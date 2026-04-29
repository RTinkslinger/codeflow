export type WatchCallback = () => void;
export declare class FileWatcher {
    private watcher;
    start(watchPath: string, onChange: WatchCallback): void;
    stop(): Promise<void>;
}
//# sourceMappingURL=watcher.d.ts.map