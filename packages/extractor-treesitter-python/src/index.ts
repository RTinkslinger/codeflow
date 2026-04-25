// @ts-expect-error — no type declarations for tree-sitter-python
import Python from 'tree-sitter-python'
import TreeSitter from 'tree-sitter'
import path from 'node:path'
import fs from 'node:fs'
import type { Extractor, ExtractorOptions, ExtractorResult, IR, CFSymbol, Relationship } from '@codeflow/core'
import { canonicalizePath, posixRelative, buildDescriptor } from '@codeflow/canonical'

// Native tree-sitter bindings — no WASM, no async init required.
// Parser instance is module-scoped (Node is single-threaded; safe for sequential calls).
const parser = new TreeSitter()
parser.setLanguage(Python as TreeSitter.Language)

const IGNORE_DIRS = new Set(['__pycache__', '.venv', 'venv', 'dist', 'build', '.git'])

export class TreeSitterPythonExtractor implements Extractor {
  readonly name = 'tree-sitter-python'
  readonly version = '0.23.x'

  async extract(opts: ExtractorOptions): Promise<ExtractorResult> {
    const start = Date.now()
    const root = canonicalizePath(opts.root)

    const pyFiles = findPyFiles(opts.path)
    const symbols: CFSymbol[] = []
    const relationships: Relationship[] = []
    const documents: IR['documents'] = []

    for (const filePath of pyFiles) {
      const canonAbs = canonicalizePath(filePath)
      let relPath: string
      try { relPath = posixRelative(root, canonAbs) }
      catch { continue }

      documents.push({ relPath, absPath: canonAbs, language: 'py' })

      const source = fs.readFileSync(filePath, 'utf-8')
      const tree = parser.parse(source)

      // Module-level symbol for the file itself (use basename WITH extension as descriptor
      // to avoid collision with a same-named class in the same file)
      const fileDescriptor = path.basename(relPath)
      const fileId = buildDescriptor({ scheme: 'tspy', manager: 'python', pkg: relPath, descriptor: fileDescriptor })
      symbols.push({
        id: fileId,
        kind: 'module',
        name: path.basename(relPath, '.py'),
        absPath: canonAbs,
        relPath,
        language: 'py',
        origin: 'extractor',
        confidence: 'inferred',
      })

      // Walk only top-level statements of the module node to avoid duplicate symbol IDs.
      // (e.g. two classes each defining __init__ would collide if we recursed into class bodies)
      for (const child of tree.rootNode.children) {
        // Import relationships
        if (child.type === 'import_statement' || child.type === 'import_from_statement') {
          const moduleName = extractModuleName(child)
          if (moduleName) {
            const toId = buildDescriptor({ scheme: 'tspy', manager: 'python', pkg: moduleName, descriptor: path.basename(moduleName) })
            const relId = `${fileId}::${toId}::imports`
            relationships.push({ id: relId, from: fileId, to: toId, kind: 'imports', language: 'py', confidence: 'inferred' })
          }
        }

        // Top-level class and function definitions
        if (child.type === 'class_definition' || child.type === 'function_definition') {
          const nameNode = child.childForFieldName('name')
          if (nameNode) {
            const symName = nameNode.text
            const symKind = child.type === 'class_definition' ? 'class' as const : 'function' as const
            const symId = buildDescriptor({ scheme: 'tspy', manager: 'python', pkg: relPath, descriptor: symName })
            symbols.push({
              id: symId,
              kind: symKind,
              name: symName,
              absPath: canonAbs,
              relPath,
              language: 'py',
              origin: 'extractor',
              confidence: 'inferred',
              parent: fileId,
            })
          }
        }
      }
    }

    const ir: IR = {
      schemaVersion: '1',
      meta: {
        extractor: { name: this.name, version: this.version, invocation: `tree-sitter-python ${opts.path}` },
        root,
      },
      documents,
      symbols,
      relationships,
    }

    return { ir, durationMs: Date.now() - start }
  }
}

function findPyFiles(dir: string): string[] {
  const results: string[] = []
  function walk(d: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(d, { withFileTypes: true }) }
    catch { return }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue
      if (entry.isDirectory()) walk(path.join(d, entry.name))
      else if (entry.isFile() && entry.name.endsWith('.py')) results.push(path.join(d, entry.name))
    }
  }
  walk(dir)
  return results
}

/**
 * Extract the imported module name from an import node.
 *
 * Grammar structures (tree-sitter-python@0.23.x):
 *   import_statement:       import <dotted_name|aliased_import> ...
 *   import_from_statement:  from <dotted_name|relative_import> import <dotted_name> ...
 *
 * In both cases children[1] holds the module reference. For relative imports
 * the text includes leading dots (e.g. ".user") which we strip to get the basename;
 * relative-import resolution is intra-package and we only need the name for the edge.
 */
function extractModuleName(node: TreeSitter.SyntaxNode): string | null {
  // children[1] is the module reference for both statement types
  const modChild = node.children[1]
  if (!modChild) return null

  let raw = modChild.text
  // For relative_import nodes the text starts with dots (e.g. ".user", "..utils")
  // Strip leading dots to get the module segment, then convert dots to slashes
  raw = raw.replace(/^\.+/, '')
  if (!raw) return null
  return raw.replace(/\./g, '/')
}
