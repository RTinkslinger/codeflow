import { App } from './app.js'
import { loadConfig } from './config.js'
export function startServer(app: App): void {
  const config = loadConfig()
  process.stdout.write(`Server running on port ${config.port}\n`)
}
