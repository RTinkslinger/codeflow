export function log(level: 'info' | 'warn' | 'error', msg: string): void {
  process.stderr.write(`[${level}] ${msg}\n`)
}
