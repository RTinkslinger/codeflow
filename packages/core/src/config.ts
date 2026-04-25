import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

const ConfigSchema = z.object({
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  previewCap: z.number().int().min(1).max(32).default(8),
  idleTimeoutMs: z.number().int().default(600_000),
  subprocessTimeoutMs: z.number().int().default(90_000),
  watcherDebounceMs: z.number().int().default(200),
  requireManualApply: z.boolean().default(false),
  portRangeStart: z.number().int().default(7800),
  portRangeEnd: z.number().int().default(7900),
}).strict()

export type CodeflowConfig = z.infer<typeof ConfigSchema>

export const defaultConfig: CodeflowConfig = ConfigSchema.parse({})

export function loadConfig(searchFrom: string): CodeflowConfig {
  const candidates = [
    path.join(searchFrom, '.codeflow.json'),
    path.join(searchFrom, 'codeflow.config.json'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
      return ConfigSchema.parse({ ...defaultConfig, ...raw })
    }
  }
  return defaultConfig
}
