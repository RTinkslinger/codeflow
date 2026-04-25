import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.resolve(__dirname, '../dist/main.js')

function sendRequest(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    proc.stdout.setEncoding('utf-8')
    proc.stdout.on('data', (d: string) => {
      out += d
      // Close stdin only after receiving a complete response line — avoids race with process.stdin 'end' handler
      if (out.includes('\n')) proc.stdin.end()
    })
    proc.on('error', reject)
    proc.on('close', () => {
      try { resolve(JSON.parse(out.trim()) as Record<string, unknown>) }
      catch { reject(new Error(`Non-JSON stdout: ${out}`)) }
    })

    const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? {} })
    proc.stdin.write(req + '\n')
  })
}

describe('JSON-RPC 2.0 wire layer', () => {
  it('valid method returns jsonrpc 2.0 response with result', async () => {
    const res = await sendRequest('list_previews')
    expect(res['jsonrpc']).toBe('2.0')
    expect(res['id']).toBe(1)
    expect(res).toHaveProperty('result')
    expect(res).not.toHaveProperty('error')
  }, 15_000)

  it('unknown method returns error with code -32601', async () => {
    const res = await sendRequest('nonexistent_method')
    expect(res['jsonrpc']).toBe('2.0')
    expect(res['id']).toBe(1)
    expect((res['error'] as Record<string, unknown>)?.['code']).toBe(-32601)
  }, 15_000)

  it('malformed JSON returns parse error with code -32700', async () => {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn('node', [CLI], { stdio: ['pipe', 'pipe', 'pipe'] })
      let out = ''
      proc.stdout.setEncoding('utf-8')
      proc.stdout.on('data', (d: string) => {
        out += d
        if (out.includes('\n')) proc.stdin.end()
      })
      proc.on('error', reject)
      proc.on('close', () => {
        try {
          const res = JSON.parse(out.trim()) as Record<string, unknown>
          expect(res['jsonrpc']).toBe('2.0')
          expect(res['id']).toBeNull()
          expect((res['error'] as Record<string, unknown>)?.['code']).toBe(-32700)
          resolve()
        } catch (e) { reject(e) }
      })
      proc.stdin.write('not valid json\n')
    })
  }, 15_000)
})
