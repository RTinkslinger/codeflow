import { log } from './logger.js'
export interface Config { port: number; dbUrl: string }
export function loadConfig(): Config {
  log('info', 'loading config')
  return { port: 3000, dbUrl: 'postgres://localhost/app' }
}
