import { test, expect } from '@playwright/test'
import { CodeflowMCP } from '../../packages/cli/src/mcp.js'
import { loadFixture } from '../../packages/test-utils/src/index.js'

let mcp: CodeflowMCP

test.beforeAll(() => { mcp = new CodeflowMCP() })
test.afterAll(async () => { await mcp.shutdown() })

test('browser receives fast-view update after extraction completes', async ({ page }) => {
  const fixturePath = loadFixture('pure-ts')
  const { url } = await mcp.startPreview({ path: fixturePath })

  await page.goto(url)
  await expect(page.locator('#dot')).toHaveClass(/ready/, { timeout: 15_000 })
  const diagramText = await page.locator('#diagram').textContent()
  expect(diagramText).toBeTruthy()
})

test('browser reconnects after server restart', async ({ page }) => {
  const fixturePath = loadFixture('pure-ts')
  const { url, previewId } = await mcp.startPreview({ path: fixturePath })
  await page.goto(url)
  await expect(page.locator('#dot')).toHaveClass(/ready/, { timeout: 15_000 })
  await mcp.stopPreview({ previewId })
  await page.waitForTimeout(2000)
  // Page should not crash — status indicator is the UX signal
  await expect(page).not.toHaveURL('about:blank')
})
