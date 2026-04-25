import { describe, it, expect, afterEach } from 'vitest'
import { allocatePort, PreviewServer, PREVIEW_HTML } from './server.js'
import http from 'node:http'
import vm from 'node:vm'

describe('allocatePort', () => {
  it('returns a port in the configured range', async () => {
    const port = await allocatePort({ start: 7800, end: 7900 })
    expect(port).toBeGreaterThanOrEqual(7800)
    expect(port).toBeLessThanOrEqual(7900)
  })

  it('falls back to OS-assigned port if range is exhausted', async () => {
    // Force range to a very narrow window
    const port = await allocatePort({ start: 0, end: 0 })
    expect(typeof port).toBe('number')
    expect(port).toBeGreaterThan(0)
  })
})

it('PREVIEW_HTML verified_ready handler updates diagram, label, and dot', async () => {
  // Extracts the inline <script> block and runs it in a vm context with stubbed browser globals.
  // Stronger than substring-presence: asserts observable DOM mutations when verified_ready fires
  // through ws.onmessage — a comment or dead-code occurrence would not change element state.
  // test-discipline: lifecycle-gap-deferred — first-vs-subsequent verified_ready animation
  // distinction (Option E spec) is not yet implemented; this asserts baseline handler only.
  const dot = { className: '', textContent: '', innerHTML: '' }
  const label = { className: '', textContent: '', innerHTML: '' }
  const diagram = { className: '', textContent: '', innerHTML: '' }
  let capturedOnMessage: ((e: { data: string }) => Promise<void>) | undefined
  const mermaidRunCalls: unknown[] = []

  const sandbox = {
    document: {
      getElementById: (id: string) =>
        ({ dot, label, diagram } as Record<string, typeof dot>)[id],
    },
    WebSocket: class {
      constructor(_url: string) {}
      // eslint-disable-next-line accessor-pairs
      set onmessage(fn: (e: { data: string }) => Promise<void>) { capturedOnMessage = fn }
      // eslint-disable-next-line accessor-pairs
      set onopen(_fn: () => void) {}
      // eslint-disable-next-line accessor-pairs
      set onclose(_fn: () => void) {}
    },
    mermaid: {
      initialize: () => {},
      run: async (opts: unknown) => { mermaidRunCalls.push(opts) },
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { host: 'localhost:7800', reload: () => {} },
    // Explicit built-ins required: async fns in the vm context use the context's Promise.
    // Providing the outer Promise ensures cross-context await works correctly.
    JSON, parseInt, Math, String, Promise,
  }

  const scriptContent = PREVIEW_HTML.match(/<script>([\s\S]+?)<\/script>/)![1] as string
  vm.runInContext(scriptContent, vm.createContext(sandbox))

  expect(capturedOnMessage).toBeDefined()
  await capturedOnMessage!({
    data: JSON.stringify({ type: 'verified_ready', mermaid: 'graph LR\n  A-->B', badge: '● verified' }),
  })

  expect(diagram.innerHTML).toBe('graph LR\n  A-->B')
  expect(label.textContent).toBe('● verified')
  expect(dot.className).toBe('ready')
  expect(mermaidRunCalls).toHaveLength(1)
})

describe('PreviewServer', () => {
  let server: PreviewServer | null = null

  afterEach(async () => { await server?.stop() })

  it('starts and serves the preview page on allocated port', async () => {
    server = new PreviewServer()
    const { port } = await server.start()
    expect(port).toBeGreaterThan(0)

    const body = await new Promise<string>((res, rej) => {
      http.get(`http://127.0.0.1:${port}/`, (r) => {
        let d = ''
        r.on('data', c => d += c)
        r.on('end', () => res(d))
      }).on('error', rej)
    })
    expect(body).toContain('codeflow')
  })

  it('stops cleanly', async () => {
    server = new PreviewServer()
    await server.start()
    await expect(server.stop()).resolves.not.toThrow()
    server = null
  })
})
