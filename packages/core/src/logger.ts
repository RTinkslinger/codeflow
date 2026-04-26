import pino from 'pino'
import pinroll from 'pino-roll'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

export const LOG_DIR = path.join(os.homedir(), '.codeflow', 'logs')
const MAX_LOG_AGE_DAYS = 14
const MAX_LOG_SIZE = '50m'

export async function createLogger(level: string = 'info', pretty = false) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  pruneOldLogs()

  // CRITICAL: MCP server communicates via stdout JSON-RPC. NEVER write logs to stdout (fd 1).
  if (pretty || process.env['CODEFLOW_LOG_PRETTY'] === '1') {
    return pino({ level }, pino.destination({ dest: 2, sync: false }))
  }

  const today = new Date().toISOString().slice(0, 10)
  const dest = await pinroll({ file: path.join(LOG_DIR, `server-${today}.log`), size: MAX_LOG_SIZE, dateFormat: 'YYYY-MM-DD' })
  return pino({ level }, dest)
}

function pruneOldLogs(): void {
  const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000
  try {
    for (const entry of fs.readdirSync(LOG_DIR)) {
      const p = path.join(LOG_DIR, entry)
      if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true })
    }
  } catch { /* best effort */ }
}

export type Logger = pino.Logger
