import { WebSocketServer, WebSocket } from 'ws'
import type http from 'node:http'

export interface BroadcastMessage {
  type: string
  /** Present on verified_ready when one or more per-workspace extractions failed (partial success). */
  workspaceWarnings?: Array<{ workspacePath: string; code: string; diagId: string }>
  [key: string]: unknown
}

export class WSBroadcaster {
  private wss: WebSocketServer
  private latestPerClient = new WeakMap<WebSocket, NodeJS.Timeout>()
  private lastMessage: BroadcastMessage | null = null

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' })
    this.wss.on('connection', (ws) => {
      ws.on('error', () => ws.terminate())
      // Replay last state to late-connecting clients (fixes race: extraction finishes before browser opens)
      if (this.lastMessage && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(this.lastMessage))
      }
    })
  }

  broadcast(msg: BroadcastMessage): void {
    this.lastMessage = msg
    const payload = JSON.stringify(msg)
    for (const client of this.wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue
      const existing = this.latestPerClient.get(client)
      if (existing) clearTimeout(existing)
      // Latest-wins: defer send by one tick, replacing any pending send
      const timer = setTimeout(() => {
        if (client.readyState === WebSocket.OPEN) client.send(payload)
        this.latestPerClient.delete(client)
      }, 0)
      this.latestPerClient.set(client, timer)
    }
  }

  close(): void {
    for (const client of this.wss.clients) {
      client.terminate()
    }
    this.wss.close()
  }
}
