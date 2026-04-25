import chokidar from 'chokidar'

const IGNORED = [
  '**/node_modules/**', '**/.git/**', '**/.venv/**', '**/venv/**',
  '**/dist/**', '**/build/**', '**/.next/**', '**/.parcel-cache/**', '**/target/**',
]

export type WatchCallback = () => void

export class FileWatcher {
  private watcher: ReturnType<typeof chokidar.watch> | null = null

  start(watchPath: string, onChange: WatchCallback): void {
    this.watcher = chokidar.watch(watchPath, {
      ignored: IGNORED,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      usePolling: false,
    })
    let debounceTimer: NodeJS.Timeout | null = null
    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => { debounceTimer = null; onChange() }, 200)
    }
    this.watcher.on('change', trigger).on('add', trigger).on('unlink', trigger)
  }

  async stop(): Promise<void> {
    await this.watcher?.close()
    this.watcher = null
  }
}
