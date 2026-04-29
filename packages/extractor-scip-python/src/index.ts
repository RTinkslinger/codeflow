import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import type { Extractor, ExtractorOptions, ExtractorResult, IR, CFSymbol, Relationship } from '@codeflow/core'
import { canonicalizePath, posixRelative } from '@codeflow/canonical'

const execFileAsync = promisify(execFile)

/**
 * Extract a human-readable name from a SCIP symbol descriptor.
 *
 * SCIP format: `<scheme> <manager> <pkg-name> <pkg-version> <descriptor>`
 * Descriptor: chain of `<name>(<disambiguator>)<suffix>` separated by `/`.
 * Suffixes: `.` (term), `#` (type), `()` (method), `:` (type-param), `[]` (alias).
 *
 * Strategy: take the last non-empty descriptor segment, strip terminal SCIP
 * suffix punctuation. Falls back to filename for module-level symbols, then
 * to the raw symId.
 */
function extractSymbolName(symId: string): string {
  // Split by space; first 4 tokens are scheme + 3-part package-id
  // Descriptor is everything after that. But package fields may contain spaces
  // when escaped — codeflow's fixtures don't hit that so we use a simple split.
  const parts = symId.split(' ')
  if (parts.length < 5) return symId   // malformed — use raw id
  const descriptor = parts.slice(4).join(' ')

  // Descriptor uses backticks around path-like segments (e.g. `index.ts`).
  // Strip all backticks for cleaner output.
  const noBackticks = descriptor.replace(/`/g, '')

  // Split on / — take the last non-empty segment
  const segments = noBackticks.split('/').filter(s => s.length > 0)
  if (segments.length === 0) return symId

  let last = segments[segments.length - 1]!

  // Strip terminal SCIP suffix punctuation first (`.` term, `#` type, `()` method, `:` type-param)
  // Order matters: strip trailing `().` or `()` before stripping lone `#` or `.`
  last = last.replace(/\(\)\.$/, '')   // method term: `foo().` → `foo`
  last = last.replace(/\(\)$/, '')     // method: `foo()` → `foo`
  last = last.replace(/[.#:[\]]+$/, '') // remaining terminal markers

  // Within a segment, `#` separates class from member (e.g. `Greeter#greet`).
  // Take the part after the last `#` when present — that's the member name.
  // If the result is empty (bare `Greeter#`), keep the part before.
  if (last.includes('#')) {
    const afterHash = last.split('#').at(-1) ?? ''
    last = afterHash.length > 0 ? afterHash : (last.split('#')[0] ?? last)
  }

  // For parameter disambiguators like `greet.(self)` — strip trailing `(anything)`
  last = last.replace(/\([^)]*\)$/, '')

  return last || symId
}

function emptyIR(name: string, version: string, invocation: string, root: string, partial = false): IR {
  return {
    schemaVersion: '1',
    meta: { extractor: { name, version, invocation }, root, ...(partial ? { partial: true } : {}) },
    documents: [],
    symbols: [],
    relationships: [],
  }
}

export class ScipPythonExtractor implements Extractor {
  readonly name = 'scip-python'
  readonly version = 'external'

  async extract(opts: ExtractorOptions): Promise<ExtractorResult> {
    const start = Date.now()
    const root = canonicalizePath(opts.root)
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow-scip-py-'))
    const outFile = path.join(outDir, 'index.scip')
    const invocation = `scip-python index ${opts.path}`

    let stderrTail: string | undefined

    try {
      const result = await execFileAsync(
        'scip-python', ['index', '--output', outFile, '--cwd', root],
        { cwd: root, timeout: opts.timeoutMs ?? 90_000 }
      )
      if (result.stderr) stderrTail = result.stderr.slice(-2000)
    } catch (err: unknown) {
      const e = err as { stderr?: string; message: string }
      stderrTail = e.stderr?.slice(-2000) ?? e.message
      fs.rmSync(outDir, { recursive: true, force: true })
      const result: ExtractorResult = { ir: emptyIR(this.name, this.version, invocation, root, true), durationMs: Date.now() - start }
      if (stderrTail !== undefined) result.stderrTail = stderrTail
      return result
    }

    const ir = parseSCIPOutputPy(outFile, root, this.name, this.version, invocation)
    fs.rmSync(outDir, { recursive: true, force: true })

    const result: ExtractorResult = { ir, durationMs: Date.now() - start }
    if (stderrTail !== undefined) result.stderrTail = stderrTail
    return result
  }
}

function parseSCIPOutputPy(scipFile: string, root: string, extractorName: string, extractorVersion: string, invocation: string): IR {
  let jsonStr: string
  try {
    jsonStr = execFileSync('scip', ['print', '--json', scipFile], { encoding: 'utf-8', timeout: 30_000 })
  } catch {
    return emptyIR(extractorName, extractorVersion, invocation, root, true)
  }

  const jsonStart = jsonStr.indexOf('{')
  if (jsonStart < 0) return emptyIR(extractorName, extractorVersion, invocation, root, true)
  const scip = JSON.parse(jsonStr.slice(jsonStart)) as Record<string, unknown>

  const symbols: CFSymbol[] = []
  const relationships: Relationship[] = []
  const documents: { relPath: string; absPath: string; language: 'py' }[] = []
  const seenSymbolIds = new Set<string>()
  const fileSymbolsByPath = new Map<string, CFSymbol>()

  const docs = scip['documents'] as Array<Record<string, unknown>> | undefined ?? []
  for (const doc of docs) {
    const relPath = doc['relative_path'] as string | undefined
    if (!relPath) continue
    const absPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath)
    const canonAbs = canonicalizePath(absPath)
    let canonRel: string
    try { canonRel = posixRelative(root, canonAbs) }
    catch { continue }

    documents.push({ relPath: canonRel, absPath: canonAbs, language: 'py' })

    const fileSymId = `file::${canonAbs}`
    if (!fileSymbolsByPath.has(canonAbs)) {
      const fileSym: CFSymbol = {
        id: fileSymId,
        kind: 'file',
        name: path.basename(canonAbs),
        absPath: canonAbs,
        relPath: canonRel,
        language: 'py',
        origin: 'extractor',
        confidence: 'verified',
      }
      fileSymbolsByPath.set(canonAbs, fileSym)
      symbols.push(fileSym)
    }

    const occurrences = doc['occurrences'] as Array<Record<string, unknown>> | undefined ?? []
    for (const occ of occurrences) {
      const symId = occ['symbol'] as string | undefined
      const rolesRaw = occ['symbol_roles'] as number | undefined
      if (!symId) continue
      const roles = rolesRaw ?? 0

      // Definition: bit 0 (0x1)
      if ((roles & 1) !== 0) {
        if (seenSymbolIds.has(symId)) continue
        seenSymbolIds.add(symId)
        const name = extractSymbolName(symId)
        symbols.push({ id: symId, kind: 'function', name, absPath: canonAbs, relPath: canonRel, language: 'py', origin: 'extractor', confidence: 'verified' })
        continue
      }

      // Skip local symbols
      if (symId.startsWith('local ')) continue

      // Import role: bit 1 (0x2) — defensive, may or may not fire on scip-python
      if ((roles & 2) !== 0) {
        relationships.push({
          id: `${fileSymId}::${symId}::imports`,
          from: fileSymId,
          to: symId,
          kind: 'imports',
          language: 'py',
          confidence: 'verified',
        })
        continue
      }

      // Any other non-Definition non-local occurrence (ReadAccess, plain ref, etc.) → 'references'
      relationships.push({
        id: `${fileSymId}::${symId}::references`,
        from: fileSymId,
        to: symId,
        kind: 'references',
        language: 'py',
        confidence: 'verified',
      })
    }
  }

  return { schemaVersion: '1', meta: { extractor: { name: extractorName, version: extractorVersion, invocation }, root }, documents, symbols, relationships }
}
