import path from 'node:path'
import fs from 'node:fs/promises'
import { canonicalizePath, posixRelative } from './canonicalizer.js'
import type { Workspace, WorkspaceLanguage } from './workspace-types.js'

export async function detectWorkspaces(rootPath: string, language: WorkspaceLanguage): Promise<Workspace[]> {
  const canonicalRoot = canonicalizePath(rootPath)
  if (language === 'ts') return detectTsWorkspaces(canonicalRoot)
  return [singlePathFallback(canonicalRoot, 'py')]   // Py paths added in Task 13
}

async function detectTsWorkspaces(rootPath: string): Promise<Workspace[]> {
  // Priority 1: pnpm-workspace.yaml
  const pnpm = await tryDetectPnpm(rootPath)
  if (pnpm && pnpm.length > 0) return computeIsLeaf(pnpm)
  // Priority 2: package.json#workspaces
  const pkgjson = await tryDetectPackageJsonWorkspaces(rootPath)
  if (pkgjson && pkgjson.length > 0) return computeIsLeaf(pkgjson)
  // Priority 3: fs-walk
  const walked = await fsWalkForTsconfig(rootPath)
  if (walked.length > 0) return computeIsLeaf(walked)
  // Priority 4 (single-path fallback)
  return [singlePathFallback(rootPath, 'ts')]
}

async function computeIsLeaf(workspaces: Workspace[]): Promise<Workspace[]> {
  // A workspace is referenced if any other workspace's tsconfig references[].path
  // resolves (canonically) to its workspacePath.
  const referenced = new Set<string>()
  for (const w of workspaces) {
    try {
      const tsconfig = JSON.parse(await fs.readFile(w.configPath, 'utf-8')) as {
        references?: Array<{ path: string }>
      }
      for (const ref of tsconfig.references ?? []) {
        const refAbs = canonicalizePath(path.resolve(w.workspacePath, ref.path))
        referenced.add(refAbs)
      }
    } catch { /* malformed/missing tsconfig — skip; isLeaf stays true */ }
  }
  return workspaces.map(w => ({ ...w, isLeaf: !referenced.has(w.workspacePath) }))
}

async function fsWalkForTsconfig(rootPath: string): Promise<Workspace[]> {
  const fastGlob = (await import('fast-glob')).default
  // Use the chokidar-aligned ignore set per spec §11
  const ignore = ['**/node_modules/**', '**/.git/**', '**/.venv/**', '**/dist/**', '**/build/**', '**/target/**', '**/.next/**', '**/.parcel-cache/**']
  const tsconfigs = await fastGlob('**/tsconfig.json', {
    cwd: rootPath,
    ignore,
    absolute: true,
    deep: 5,
    onlyFiles: true,
  })
  if (tsconfigs.length === 0) return []
  return Promise.all(tsconfigs.map(t => buildTsWorkspace(rootPath, path.dirname(t), 'fs-fallback')))
}

async function tryDetectPnpm(rootPath: string): Promise<Workspace[] | null> {
  const ymlPath = path.join(rootPath, 'pnpm-workspace.yaml')
  if (!await exists(ymlPath)) return null
  // Use @pnpm/find-workspace-packages — handles glob expansion, exclusions,
  // pnpm v9 catalog form, and package.json `{packages, nohoist}` variants.
  const { findWorkspacePackages } = await import('@pnpm/find-workspace-packages')
  const projects = await findWorkspacePackages(rootPath)
  // Skip the root project (its dir === rootPath)
  return Promise.all(
    projects
      .filter(p => canonicalizePath(p.dir) !== rootPath)
      .map(p => buildTsWorkspace(rootPath, p.dir, 'pnpm'))
  )
}

async function tryDetectPackageJsonWorkspaces(rootPath: string): Promise<Workspace[] | null> {
  const pkgPath = path.join(rootPath, 'package.json')
  if (!await exists(pkgPath)) return null
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as {
    workspaces?: string[] | { packages?: string[] }
  }
  const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages
  if (!patterns || patterns.length === 0) return null
  const fastGlob = (await import('fast-glob')).default
  const dirs = await fastGlob(patterns, {
    cwd: rootPath,
    onlyDirectories: true,
    absolute: true,
  })
  return Promise.all(dirs.map(d => buildTsWorkspace(rootPath, d, 'pkgjson')))
}

async function buildTsWorkspace(
  rootPath: string,
  workspacePath: string,
  manifest: 'pnpm' | 'pkgjson' | 'fs-fallback',
): Promise<Workspace> {
  const canonicalWsPath = canonicalizePath(workspacePath)
  const tsconfigPath = path.join(canonicalWsPath, 'tsconfig.json')
  const pkgPath = path.join(canonicalWsPath, 'package.json')
  let displayName: string
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as { name?: string }
    displayName = pkg.name ?? posixRelative(rootPath, canonicalWsPath)
  } catch {
    displayName = posixRelative(rootPath, canonicalWsPath)
  }
  return {
    rootPath,
    workspacePath: canonicalWsPath,
    workspaceRel: posixRelative(rootPath, canonicalWsPath),
    manifest,
    language: 'ts',
    configPath: tsconfigPath,
    isLeaf: true,   // computed properly in Task 12
    displayName,
  }
}

function singlePathFallback(rootPath: string, language: WorkspaceLanguage): Workspace {
  const cfg = language === 'ts' ? 'tsconfig.json' : 'pyproject.toml'
  return {
    rootPath,
    workspacePath: rootPath,
    workspaceRel: '.',
    manifest: 'fs-fallback',
    language,
    configPath: path.join(rootPath, cfg),
    isLeaf: true,
    displayName: path.basename(rootPath),
  }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true }
  catch { return false }
}
