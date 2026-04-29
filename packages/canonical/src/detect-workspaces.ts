import path from 'node:path'
import fs from 'node:fs/promises'
import { canonicalizePath, posixRelative } from './canonicalizer.js'
import type { Workspace, WorkspaceLanguage } from './workspace-types.js'

const memoCache = new Map<string, { mtimeKey: string; workspaces: Workspace[] }>()

export function _resetMemoCache(): void {
  memoCache.clear()
}

async function manifestMtimeKey(rootPath: string): Promise<string> {
  const candidates = ['pnpm-workspace.yaml', 'package.json', 'pyproject.toml', 'setup.py']
  const stats: string[] = []
  for (const c of candidates) {
    try {
      const stat = await fs.stat(path.join(rootPath, c))
      stats.push(`${c}:${stat.mtimeMs}`)
    } catch { /* not present */ }
  }
  return stats.join('|')
}

export async function detectWorkspaces(rootPath: string, language: WorkspaceLanguage): Promise<Workspace[]> {
  const canonicalRoot = canonicalizePath(rootPath)
  const key = `${canonicalRoot}::${language}`
  const mtimeKey = await manifestMtimeKey(canonicalRoot)
  const cached = memoCache.get(key)
  if (cached && cached.mtimeKey === mtimeKey) return cached.workspaces
  const workspaces = language === 'ts'
    ? await detectTsWorkspaces(canonicalRoot)
    : await detectPyWorkspaces(canonicalRoot)
  memoCache.set(key, { mtimeKey, workspaces })
  return workspaces
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

async function buildPyWorkspaceFromSetupPy(
  rootPath: string,
  workspacePath: string,
): Promise<Workspace> {
  const canonicalWsPath = canonicalizePath(workspacePath)
  const setupPath = path.join(canonicalWsPath, 'setup.py')
  let displayName = posixRelative(rootPath, canonicalWsPath) || '.'
  try {
    const content = await fs.readFile(setupPath, 'utf-8')
    const { extractSetupPyName } = await import('./extract-setup-py-name.js')
    const { name } = extractSetupPyName(content)
    if (name) displayName = name
  } catch {
    // keep displayName fallback
  }
  return {
    rootPath,
    workspacePath: canonicalWsPath,
    workspaceRel: posixRelative(rootPath, canonicalWsPath) || '.',
    manifest: 'setup.py',
    language: 'py',
    configPath: setupPath,
    isLeaf: true,
    displayName,
  }
}

async function detectPyWorkspaces(rootPath: string): Promise<Workspace[]> {
  const tomlPath = path.join(rootPath, 'pyproject.toml')
  if (await exists(tomlPath)) {
    const tomlContent = await fs.readFile(tomlPath, 'utf-8')
    const toml = (await import('@iarna/toml')).default.parse(tomlContent) as Record<string, any>
    const tables: string[][] = []
    if (toml.tool?.uv?.workspace?.members) tables.push(toml.tool.uv.workspace.members)
    if (toml.tool?.pdm?.workspace?.members) tables.push(toml.tool.pdm.workspace.members)
    if (toml.tool?.rye?.workspaces) tables.push(toml.tool.rye.workspaces)
    if (tables.length > 0) {
      const fastGlob = (await import('fast-glob')).default
      const patterns = tables.flat()
      const dirs = await fastGlob(patterns, {
        cwd: rootPath,
        onlyDirectories: true,
        absolute: true,
      })
      // Filter to dirs that actually contain pyproject.toml
      const valid: string[] = []
      for (const d of dirs) {
        if (await exists(path.join(d, 'pyproject.toml'))) valid.push(d)
      }
      return Promise.all(valid.map(d => buildPyWorkspace(rootPath, d, 'pyproject')))
    }
    // Single pyproject.toml at root
    return [await buildPyWorkspace(rootPath, rootPath, 'pyproject')]
  }
  // Priority 3: setup.py at root (only if no pyproject at root, which is guaranteed here since we fell through).
  const setupPath = path.join(rootPath, 'setup.py')
  if (await exists(setupPath)) {
    return [await buildPyWorkspaceFromSetupPy(rootPath, rootPath)]
  }
  // fs-walk: pyproject.toml AND setup.py (pyproject wins per-dir)
  const fastGlob = (await import('fast-glob')).default
  const ignore = ['**/node_modules/**', '**/.git/**', '**/.venv/**', '**/__pycache__/**', '**/dist/**', '**/build/**']
  const pyprojects = await fastGlob('**/pyproject.toml', { cwd: rootPath, ignore, absolute: true, deep: 5, onlyFiles: true })
  const setups = await fastGlob('**/setup.py', { cwd: rootPath, ignore, absolute: true, deep: 5, onlyFiles: true })
  const pyprojectDirs = new Set(pyprojects.map(f => path.dirname(f)))
  const results: Workspace[] = []
  for (const f of pyprojects) {
    results.push(await buildPyWorkspace(rootPath, path.dirname(f), 'fs-fallback'))
  }
  for (const f of setups) {
    const d = path.dirname(f)
    if (!pyprojectDirs.has(d)) results.push(await buildPyWorkspaceFromSetupPy(rootPath, d))
  }
  if (results.length > 0) return results
  return [singlePathFallback(rootPath, 'py')]
}

async function buildPyWorkspace(
  rootPath: string,
  workspacePath: string,
  manifest: 'pyproject' | 'fs-fallback',
): Promise<Workspace> {
  const canonicalWsPath = canonicalizePath(workspacePath)
  const tomlPath = path.join(canonicalWsPath, 'pyproject.toml')
  let displayName: string
  try {
    const tomlContent = await fs.readFile(tomlPath, 'utf-8')
    const toml = (await import('@iarna/toml')).default.parse(tomlContent) as Record<string, any>
    displayName = toml.project?.name ?? posixRelative(rootPath, canonicalWsPath)
  } catch {
    displayName = posixRelative(rootPath, canonicalWsPath)
  }
  return {
    rootPath,
    workspacePath: canonicalWsPath,
    workspaceRel: posixRelative(rootPath, canonicalWsPath),
    manifest,
    language: 'py',
    configPath: tomlPath,
    isLeaf: true,
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
