import pino from 'pino'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const LOG_DIR = path.join(os.homedir(), '.codeflow', 'logs')

export function createLogger(level: string = 'info', pretty = false) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const today = new Date().toISOString().slice(0, 10)
  const logFile = path.join(LOG_DIR, `server-${today}.log`)

  // CRITICAL: MCP server communicates via stdout JSON-RPC. NEVER write logs to stdout (fd 1).
  if (pretty || process.env['CODEFLOW_LOG_PRETTY'] === '1') {
    return pino({ level }, pino.destination({ dest: 2, sync: false }))
  }
  return pino({ level }, pino.destination({ dest: logFile, sync: false }))
}

export type Logger = pino.Logger
