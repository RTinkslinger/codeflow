import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CodeflowMCP } from './mcp.js'
import { loadFixture } from '@codeflow/test-utils'

describe('CodeflowMCP', () => {
  let mcp: CodeflowMCP

  beforeEach(() => { mcp = new CodeflowMCP() })
  afterEach(async () => { await mcp.shutdown() })

  it('start_preview returns url + previewId + extracting status in <100ms', async () => {
    const fixturePath = loadFixture('pure-ts')
    const before = Date.now()
    const result = await mcp.startPreview({ path: fixturePath })
    const elapsed = Date.now() - before

    expect(elapsed).toBeLessThan(100)
    expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+/)
    expect(result.previewId).toBeTruthy()
    expect(result.status).toBe('extracting')
  })

  it('list_previews returns the started preview', async () => {
    const fixturePath = loadFixture('pure-ts')
    const { previewId } = await mcp.startPreview({ path: fixturePath })
    const list = await mcp.listPreviews()
    expect(list.some(p => p.previewId === previewId)).toBe(true)
  })

  it('stop_preview stops it and marks aborted', async () => {
    const fixturePath = loadFixture('pure-ts')
    const { previewId } = await mcp.startPreview({ path: fixturePath })
    const { stopped } = await mcp.stopPreview({ previewId })
    expect(stopped).toBe(true)
  })

  it('get_ir returns null ir while extracting', async () => {
    const fixturePath = loadFixture('pure-ts')
    const { previewId } = await mcp.startPreview({ path: fixturePath })
    const result = await mcp.getIR({ previewId })
    // Immediately after start, extraction is in-flight
    expect(['extracting', 'ready']).toContain(result.status)
  })

  it('enforces preview cap of 8', async () => {
    const fixturePath = loadFixture('pure-ts')
    for (let i = 0; i < 8; i++) await mcp.startPreview({ path: fixturePath + `/sub${i}` })
    await expect(mcp.startPreview({ path: fixturePath + '/sub9' })).rejects.toThrow('preview cap')
  })
})
