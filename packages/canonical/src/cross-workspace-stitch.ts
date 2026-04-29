import type { IR, CFSymbol, Relationship } from '@codeflow/core'

/**
 * Rewrite cross-workspace external references to point at internal file-symbols
 * when the SCIP package name matches a workspace's displayName.
 *
 * Pre-condition: ir.symbols and ir.relationships have already been canonically
 * merged via canonicalMerge. ir.meta.workspaces is populated with displayName
 * per workspaceRel.
 *
 * Returns a new IR with relationships rewritten (symbols are unchanged).
 *
 * # Why this is needed
 *
 * canonicalMerge enforces "one file on disk → one node in the merged graph."
 * File-symbols (id: `file::<absPath>`) survive; SCIP named symbols (e.g.
 * `scip-typescript npm @codeflow/core 0.1.0 src/`errors.ts`/CodeflowError#`)
 * get deduped away. Post-merge, only file-symbols exist as internal nodes.
 *
 * # Empirical basis (captured 2026-04-30 from real codeflow repo)
 *
 * Running scip-typescript on packages/core (the "Definition" side) emits:
 *   Definition: scip-typescript npm @codeflow/core 0.1.0 src/`errors.ts`/CodeflowError#
 *   Definition: scip-typescript npm @codeflow/core 0.1.0 src/`errors.ts`/createError().
 *   Definition: scip-typescript npm @codeflow/core 0.1.0 src/`index.ts`/
 *
 * Running scip-typescript on packages/cli (imports core via pnpm symlink
 * node_modules/@codeflow/core → ../core) emits references using the compiled dist:
 *   Reference: scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/CodeflowError#
 *   Reference: scip-typescript npm @codeflow/core 0.1.0 dist/`errors.d.ts`/createError().
 *   Reference: scip-typescript npm @codeflow/core 0.1.0 dist/`index.d.ts`/
 *
 * The package portion (@codeflow/core 0.1.0) matches. The file path differs:
 *   src/`<name>.ts`  (source, Definition side)
 *   dist/`<name>.d.ts` (compiled, Reference side)
 *
 * Since SCIP named defs are dropped by canonicalMerge, we stitch to the file-symbol
 * of the corresponding internal source file. We match by:
 *   (pkgName, moduleKey)
 * where moduleKey strips the src|dist prefix and .ts|.d.ts|.tsx|.js extension
 * from the backtick-wrapped file token.
 *
 * Example: `dist/`errors.d.ts`` → moduleKey="errors" → matches file-symbol for
 * packages/core/src/errors.ts whose workspaceRel="packages/core" and displayName="@codeflow/core".
 */
export function stitchCrossWorkspaceEdges(ir: IR): IR {
  const workspaces = ir.meta.workspaces
  if (!workspaces || Object.keys(workspaces).length === 0) return ir

  // Build reverse map: displayName → workspaceRel
  const displayNameToWorkspaceRel = new Map<string, string>()
  for (const [wsRel, ws] of Object.entries(workspaces)) {
    displayNameToWorkspaceRel.set(ws.displayName, wsRel)
  }

  // Build lookup table from internal file-symbols:
  //   key = `<pkgName>::<moduleKey>` → file-symbol id
  //
  // Internal file-symbols have id="file::<absPath>" and workspaceRel set.
  // We derive moduleKey from relPath by stripping the workspaceRel prefix,
  // then stripping src/dist prefix + file extension.
  //
  // E.g. relPath="packages/core/src/errors.ts", workspaceRel="packages/core"
  //   → stripped = "src/errors.ts" → moduleKey = "errors"
  // displayName for "packages/core" = "@codeflow/core"
  //   → key = "@codeflow/core::errors"
  const defTable = new Map<string, string>()    // key → file-symbol id
  const ambiguous = new Set<string>()

  for (const sym of ir.symbols) {
    if (!sym.workspaceRel) continue
    if (!sym.id.startsWith('file::')) continue  // only file-symbols survive canonicalMerge

    const wsEntry = workspaces[sym.workspaceRel]
    if (!wsEntry) continue
    const pkgName = wsEntry.displayName

    // Strip workspaceRel prefix from relPath to get the within-workspace path
    let withinWs = sym.relPath
    if (withinWs.startsWith(sym.workspaceRel + '/')) {
      withinWs = withinWs.slice(sym.workspaceRel.length + 1)
    }

    const moduleKey = normalizeFilePath(withinWs)
    if (!moduleKey) continue

    const key = `${pkgName}::${moduleKey}`
    if (defTable.has(key)) {
      if (!ambiguous.has(key)) {
        ambiguous.add(key)
        process.stderr.write(
          `[codeflow:stitch] ambiguous match for key "${key}": ` +
          `"${defTable.get(key)!}" vs "${sym.id}" — skipping stitch for this key\n`
        )
      }
    } else {
      defTable.set(key, sym.id)
    }
  }

  for (const key of ambiguous) {
    defTable.delete(key)
  }

  if (defTable.size === 0) return ir

  const internalSymbolIds = new Set(ir.symbols.filter(s => s.workspaceRel).map(s => s.id))

  let stitchedCount = 0
  const rewrittenRels: Relationship[] = ir.relationships.map(rel => {
    if (internalSymbolIds.has(rel.to)) return rel  // already internal
    const parsed = parseScipSymbol(rel.to)
    if (!parsed) return rel
    const { pkgName, descriptor } = parsed
    if (!displayNameToWorkspaceRel.has(pkgName)) return rel
    const fileToken = extractFileToken(descriptor)
    if (!fileToken) return rel
    const moduleKey = normalizeFilePath(fileToken.token)
    if (!moduleKey) return rel
    const key = `${pkgName}::${moduleKey}`
    const internalId = defTable.get(key)
    if (!internalId) return rel
    stitchedCount++
    return { ...rel, to: internalId }
  })

  if (stitchedCount > 0) {
    process.stderr.write(`[codeflow:stitch] stitched ${stitchedCount} cross-workspace edge(s)\n`)
  }

  // Deduplicate by (from, to, kind) after rewrite, preferring verified
  const relMap = new Map<string, Relationship>()
  for (const rel of rewrittenRels) {
    if (rel.from === rel.to) continue  // drop self-loops
    const key = `${rel.from}::${rel.to}::${rel.kind}`
    const existing = relMap.get(key)
    if (existing === undefined || (rel.confidence === 'verified' && existing.confidence === 'inferred')) {
      relMap.set(key, rel)
    }
  }

  return { ...ir, relationships: [...relMap.values()] }
}

// --- Internal helpers ---

interface ParsedScipSymbol {
  scheme: string
  manager: string
  pkgName: string
  version: string
  descriptor: string
}

/**
 * Parse a SCIP symbol string.
 * Format: `<scheme> <manager> <pkgName> <version> <descriptor>`
 *
 * Returns null for non-SCIP symbols (file:: ids, local symbols, etc.)
 */
function parseScipSymbol(id: string): ParsedScipSymbol | null {
  if (id.startsWith('file::') || id.startsWith('local ')) return null
  const parts = id.split(' ')
  if (parts.length < 5) return null
  const [scheme, manager, pkgName, version, ...rest] = parts as [string, string, string, string, ...string[]]
  return { scheme, manager, pkgName, version, descriptor: rest.join(' ') }
}

interface FileTokenResult {
  token: string  // e.g. "dist/errors.d.ts" (prefix + inner, no backticks)
  after: string  // e.g. "CodeflowError#" (everything after the file token)
}

/**
 * Extract the first backtick-wrapped file token from a SCIP descriptor.
 *
 * Examples:
 *   "src/`errors.ts`/CodeflowError#" → { token: "src/errors.ts", after: "CodeflowError#" }
 *   "dist/`errors.d.ts`/CodeflowError#" → { token: "dist/errors.d.ts", after: "CodeflowError#" }
 *   "src/`index.ts`/" → { token: "src/index.ts", after: "" }
 */
function extractFileToken(descriptor: string): FileTokenResult | null {
  const btOpen = descriptor.indexOf('`')
  if (btOpen === -1) return null
  const btClose = descriptor.indexOf('`', btOpen + 1)
  if (btClose === -1) return null

  const prefix = descriptor.slice(0, btOpen)
  const inner = descriptor.slice(btOpen + 1, btClose)
  const token = prefix + inner  // e.g. "src/errors.ts"

  let after = descriptor.slice(btClose + 1)
  if (after.startsWith('/')) after = after.slice(1)

  return { token, after }
}

/**
 * Normalize a file path (either a within-workspace relPath like "src/errors.ts"
 * or a SCIP file token like "dist/errors.d.ts") to a stable module key by:
 * 1. Stripping a leading src/ or dist/ directory prefix
 * 2. Stripping the file extension (.ts, .d.ts, .tsx, .js, .jsx, .d.tsx)
 *
 * Examples:
 *   "src/errors.ts"      → "errors"
 *   "dist/errors.d.ts"   → "errors"
 *   "src/sub/utils.ts"   → "sub/utils"
 *   "dist/sub/utils.d.ts" → "sub/utils"
 *   "src/index.ts"       → "index"
 *   "dist/index.d.ts"    → "index"
 *
 * Returns empty string (falsy) if normalization produces nothing useful.
 */
function normalizeFilePath(filePath: string): string {
  let p = filePath
  if (p.startsWith('src/')) p = p.slice('src/'.length)
  else if (p.startsWith('dist/')) p = p.slice('dist/'.length)

  // Strip extensions, longest first
  const exts = ['.d.tsx', '.d.ts', '.tsx', '.ts', '.js', '.jsx']
  for (const ext of exts) {
    if (p.endsWith(ext)) {
      p = p.slice(0, -ext.length)
      break
    }
  }

  return p
}
