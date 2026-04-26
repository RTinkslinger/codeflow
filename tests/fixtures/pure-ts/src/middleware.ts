import { log } from './logger.js'
export function requestLogger(req: unknown, res: unknown, next: () => void): void {
  log('info', 'request received')
  next()
}
