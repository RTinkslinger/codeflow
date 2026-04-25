import { execSync } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import type { CodeflowError } from '@codeflow/core'

const DIAG_DIR = path.join(os.homedir(), '.codeflow', 'diagnostics')
const DIAG_CAP = 100

interface DoctorReport {
  node: string
  os: string
  platform: string
  tools: Record<string, boolean>
  recentErrors: string[]
}

function checkTool(cmd: string): boolean {
  try { execSync(`${cmd} --version`, { stdio: 'ignore', timeout: 5000 }); return true }
  catch { return false }
}

export async function runDoctor(): Promise<DoctorReport> {
  return {
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    platform: process.platform,
    tools: {
      depcruise: checkTool('npx depcruise'),
      'scip-typescript': checkTool('scip-typescript'),
      'scip-python': checkTool('scip-python'),
    },
    recentErrors: listRecentDiags(),
  }
}

function listRecentDiags(): string[] {
  if (!fs.existsSync(DIAG_DIR)) return []
  return fs.readdirSync(DIAG_DIR)
    .map(d => ({ d, mtime: fs.statSync(path.join(DIAG_DIR, d)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime)
    .slice(-5)
    .map(({ d }) => path.join(DIAG_DIR, d, 'error.json'))
    .filter(p => fs.existsSync(p))
    .map(p => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')).code } catch { return '?' } })
}

interface BundleContents {
  error: CodeflowError
  context: Record<string, unknown>
  irPartial?: unknown
  stderrTail?: string
  logTail?: string
}

export async function saveDiagBundle(diagId: string, contents: BundleContents): Promise<string> {
  evictOldBundles()
  const bundleDir = path.join(DIAG_DIR, diagId)
  fs.mkdirSync(bundleDir, { recursive: true })
  fs.writeFileSync(path.join(bundleDir, 'error.json'), JSON.stringify(contents.error, null, 2))
  fs.writeFileSync(path.join(bundleDir, 'context.json'), JSON.stringify(contents.context, null, 2))
  if (contents.irPartial) fs.writeFileSync(path.join(bundleDir, 'ir-partial.json'), JSON.stringify(contents.irPartial, null, 2))
  if (contents.stderrTail) fs.writeFileSync(path.join(bundleDir, 'subprocess-stderr.txt'), contents.stderrTail)
  fs.writeFileSync(path.join(bundleDir, 'env.json'), JSON.stringify({ node: process.version, os: os.type(), platform: process.platform, release: os.release() }, null, 2))
  return bundleDir
}

function evictOldBundles(): void {
  if (!fs.existsSync(DIAG_DIR)) return
  const entries = fs.readdirSync(DIAG_DIR)
  if (entries.length >= DIAG_CAP) {
    entries.sort().slice(0, entries.length - DIAG_CAP + 1).forEach(e => {
      fs.rmSync(path.join(DIAG_DIR, e), { recursive: true, force: true })
    })
  }
}
