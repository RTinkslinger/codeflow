import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.resolve(__dirname, '../dist/main.js')

describe('CLI doctor subcommand', () => {
  it('outputs JSON with node version, os, and tools map when invoked as: node main.js doctor', () => {
    // Bug: main.ts has no `doctor` subcommand handler — the process falls through
    //      to MCP stdio mode and waits forever on process.stdin, causing a timeout.
    // Fix: add `if (args[0] === 'doctor')` branch that calls runDoctor() and prints JSON.
    const result = spawnSync('node', [CLI, 'doctor'], { encoding: 'utf-8', timeout: 15_000 })

    expect(result.status).toBe(0)
    const output = JSON.parse(result.stdout) as Record<string, unknown>
    expect(output).toHaveProperty('node')
    expect(String(output['node'])).toMatch(/^v\d+/)
    expect(output).toHaveProperty('os')
    expect(output).toHaveProperty('tools')
    const tools = output['tools'] as Record<string, boolean>
    expect(typeof tools['depcruise']).toBe('boolean')
  }, 20_000)
})
