import { describe, it, expect } from 'vitest'
import { runDoctor, saveDiagBundle } from './doctor.js'

describe('runDoctor', () => {
  it('returns node version, OS, and tool availability', async () => {
    const report = await runDoctor()
    expect(report.node).toMatch(/^v\d+/)
    expect(report.os).toBeTruthy()
    expect(typeof report.tools.depcruise).toBe('boolean')
    expect(typeof report.tools['scip-typescript']).toBe('boolean')
    expect(typeof report.tools['scip-python']).toBe('boolean')
  })
})

describe('saveDiagBundle', () => {
  it('creates a bundle directory with required files', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const os = await import('node:os')

    const diagId = 'test-diag-' + Date.now()
    await saveDiagBundle(diagId, {
      error: { code: 'TEST', category: 'runtime', severity: 'warning', title: 'Test', detail: 'Test detail', nextStep: 'None', context: {}, diagId, timestamp: new Date().toISOString(), docsUrl: '' },
      context: { test: true },
    })

    const bundleDir = path.join(os.homedir(), '.codeflow', 'diagnostics', diagId)
    expect(fs.existsSync(path.join(bundleDir, 'error.json'))).toBe(true)
    expect(fs.existsSync(path.join(bundleDir, 'context.json'))).toBe(true)
    expect(fs.existsSync(path.join(bundleDir, 'env.json'))).toBe(true)
  })
})
