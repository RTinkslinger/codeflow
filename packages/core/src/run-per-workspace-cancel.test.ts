import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { runPerWorkspace, type WorkspaceLike } from './run-per-workspace.js'

const items: WorkspaceLike[] = [
  { workspaceRel: 'a', workspacePath: '/r/a' },
  { workspaceRel: 'b', workspacePath: '/r/b' },
]

describe('runPerWorkspace cancellation', () => {
  it('lane budget timeout kills consumer-spawned child processes (no zombies)', async () => {
    const pids: number[] = []

    const out = await runPerWorkspace(
      items,
      async (_w, signal) => {
        // Simulate scip-typescript: spawn long-running child; honor signal per contract
        const child = spawn('sleep', ['60'])
        if (child.pid !== undefined) pids.push(child.pid)
        signal.addEventListener('abort', () => {
          child.kill('SIGTERM')
          // After 2s grace, escalate to SIGKILL (consumer responsibility per JSDoc)
          setTimeout(() => {
            try { child.kill('SIGKILL') } catch { /* already exited */ }
          }, 2_000)
        })
        return new Promise<string>((resolve, reject) => {
          child.on('exit', (code) => code === 0 ? resolve('ok') : reject(new Error(`exit ${code}`)))
          child.on('error', reject)
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
      },
      { concurrency: 2, timeoutMs: 30_000, laneBudgetMs: 500 },   // budget fires before sleep finishes
    )

    expect(out.cancelled).toBe(true)
    expect(out.errors.length).toBe(2)

    // Wait for SIGTERM to land then verify no zombies
    await new Promise(r => setTimeout(r, 500))

    for (const pid of pids) {
      let alive: boolean
      try {
        process.kill(pid, 0)   // signal 0 = test if alive
        alive = true
      } catch {
        alive = false   // ESRCH — process gone
      }
      expect(alive, `pid ${pid} still alive — zombie`).toBe(false)
    }
  }, 30_000)

  it('per-item timeout kills only that item, others continue', async () => {
    const pids: { ws: string; pid: number }[] = []

    const out = await runPerWorkspace(
      items,
      async (w, signal) => {
        const child = spawn('sleep', [w.workspaceRel === 'a' ? '60' : '0.05'])
        if (child.pid !== undefined) pids.push({ ws: w.workspaceRel, pid: child.pid })
        signal.addEventListener('abort', () => child.kill('SIGTERM'))
        return new Promise<string>((resolve, reject) => {
          child.on('exit', (code) => code === 0 ? resolve('ok') : reject(new Error(`exit ${code}`)))
          child.on('error', reject)
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
      },
      { concurrency: 2, timeoutMs: 200, laneBudgetMs: 30_000 },   // 'a' will timeout, 'b' completes fast
    )

    expect(out.cancelled).toBe(false)   // lane budget did NOT exhaust
    expect(out.results.length).toBe(1)  // 'b' succeeded
    expect(out.errors.length).toBe(1)
    expect(out.errors[0]!.workspace.workspaceRel).toBe('a')

    // Wait, then verify 'a' is dead
    await new Promise(r => setTimeout(r, 300))
    const aPid = pids.find(p => p.ws === 'a')!.pid
    let alive: boolean
    try { process.kill(aPid, 0); alive = true } catch { alive = false }
    expect(alive, `pid ${aPid} for ws 'a' still alive`).toBe(false)
  }, 30_000)
})
