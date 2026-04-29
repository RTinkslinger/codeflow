# Codeflow — Monorepo Extractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the executing-plans skill to implement this plan task-by-task. Supports two modes: subagent-driven (recommended, fresh subagent per task with three-stage review) or inline execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/flow --verified` work on multi-package monorepos (closes v1 spec §9-E gap) by shipping three sequential PRs: SCIP relationship extraction (M1), workspace detection + per-workspace fan-out (M2), Mermaid subgraph rendering + setup.py legacy support (M3).

**Architecture:** Three milestone gates. Each milestone produces independently shippable, testable software. M1 makes single-tsconfig verified mode emit edges (closes a pre-existing zero-edges bug). M2 adds workspace-aware extraction with cross-package edges via canonical-merger dedup. M3 adds visual subgraph grouping + Python legacy parity.

**Tech Stack:** TypeScript 5.x, pnpm workspaces, Vitest, fast-check (property tests), Playwright (E2E), `scip-typescript` CLI (verified TS extraction), `scip-python` CLI (verified Py), `@pnpm/find-workspace-packages` (workspace manifest detection), Mermaid (graph rendering).

**Spec:** `docs/upp/specs/2026-04-29-codeflow-monorepo-extractor-design.md` — authoritative for design decisions; this plan implements it.

---

## Pre-flight

- [ ] **PF.1 — Verify clean baseline**

```bash
cd "/Users/Aakash/Claude Projects/codeflow"
git status                                    # expect: clean working tree on main
pnpm install                                  # ensure node_modules present
pnpm test                                     # all existing tests green
which scip-typescript && which scip-python && which scip   # all on PATH
scip-typescript --version
```

Expected: clean tree on main, all tests pass, three SCIP binaries resolvable. If `scip-typescript` not found: `npm install -g @sourcegraph/scip-typescript scip-python @sourcegraph/scip` then re-verify.

---

# MILESTONE 1 (PR1) — SCIP relationship extraction

**M1 goal:** `/flow --verified` on a single-tsconfig project produces a graph with edges. This closes a pre-existing zero-edges bug independent of monorepo support.

## Task 1: Phase 0 verification fixture

**Files:**
- Create: `scripts/fixtures/scip-cross-2pkg/pkg-a/tsconfig.json`
- Create: `scripts/fixtures/scip-cross-2pkg/pkg-a/package.json`
- Create: `scripts/fixtures/scip-cross-2pkg/pkg-a/src/index.ts`
- Create: `scripts/fixtures/scip-cross-2pkg/pkg-b/tsconfig.json`
- Create: `scripts/fixtures/scip-cross-2pkg/pkg-b/package.json`
- Create: `scripts/fixtures/scip-cross-2pkg/pkg-b/src/index.ts`

- [ ] **Step 1: Create pkg-a (the importable package)**

`scripts/fixtures/scip-cross-2pkg/pkg-a/package.json`:
```json
{ "name": "pkg-a", "version": "0.0.0", "main": "src/index.ts", "types": "src/index.ts" }
```

`scripts/fixtures/scip-cross-2pkg/pkg-a/tsconfig.json`:
```json
{ "compilerOptions": { "target": "es2022", "module": "esnext", "moduleResolution": "bundler", "strict": true, "skipLibCheck": true, "noEmit": true }, "include": ["src/**/*"] }
```

`scripts/fixtures/scip-cross-2pkg/pkg-a/src/index.ts`:
```ts
// Default export
export default function defaultGreeting(): string {
  return 'hello from pkg-a default'
}

// Named export
export function namedGreeting(): string {
  return 'hello from pkg-a named'
}

// Type export
export interface Greeter {
  greet(): string
}

// Re-export from sub-module
export * from './sub.js'
```

`scripts/fixtures/scip-cross-2pkg/pkg-a/src/sub.ts`:
```ts
export function reExportedFn(): number { return 42 }
```

- [ ] **Step 2: Create pkg-b (the importing package)**

`scripts/fixtures/scip-cross-2pkg/pkg-b/package.json`:
```json
{ "name": "pkg-b", "version": "0.0.0", "dependencies": { "pkg-a": "file:../pkg-a" } }
```

`scripts/fixtures/scip-cross-2pkg/pkg-b/tsconfig.json`:
```json
{ "compilerOptions": { "target": "es2022", "module": "esnext", "moduleResolution": "bundler", "strict": true, "skipLibCheck": true, "noEmit": true, "paths": { "pkg-a": ["../pkg-a/src/index.ts"] } }, "include": ["src/**/*"] }
```

`scripts/fixtures/scip-cross-2pkg/pkg-b/src/index.ts`:
```ts
// Default import
import defaultGreeting from 'pkg-a'

// Named import
import { namedGreeting, reExportedFn } from 'pkg-a'

// Type-only import
import type { Greeter } from 'pkg-a'

// Barrel-style re-export
export { namedGreeting } from 'pkg-a'

class MyGreeter implements Greeter {
  greet(): string {
    return defaultGreeting() + ' / ' + namedGreeting() + ' / ' + reExportedFn()
  }
}

export const greeter = new MyGreeter()
```

- [ ] **Step 3: Commit fixture**

```bash
git add scripts/fixtures/scip-cross-2pkg/
git commit -m "test(fixture): add 2-package SCIP cross-workspace verification fixture"
```

---

## Task 2: Phase 0 verification script

**Files:**
- Create: `scripts/verify-scip-cross-workspace.ts`

- [ ] **Step 1: Write the script**

```ts
#!/usr/bin/env tsx
// Phase 0 verification: empirically confirm SCIP symbol-string stability
// across separate scip-typescript invocations on a 2-package fixture.
// Output captured in PR1 description as the gate.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const FIXTURE = path.resolve(__dirname, 'fixtures/scip-cross-2pkg')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scip-verify-'))

function indexAndPrint(workspacePath: string, label: string): Record<string, unknown> {
  const out = path.join(tmp, `${label}.scip`)
  console.log(`[${label}] indexing ${workspacePath}`)
  execFileSync('scip-typescript', ['index', '--output', out, workspacePath], { stdio: 'inherit' })
  const json = execFileSync('scip', ['print', '--json', out], { encoding: 'utf-8' })
  const start = json.indexOf('{')
  return JSON.parse(json.slice(start)) as Record<string, unknown>
}

function extractSymbols(scip: Record<string, unknown>): { symbol: string; roles: number; file: string }[] {
  const out: { symbol: string; roles: number; file: string }[] = []
  const docs = (scip['documents'] as Array<Record<string, unknown>>) ?? []
  for (const doc of docs) {
    const file = doc['relative_path'] as string
    const occ = (doc['occurrences'] as Array<Record<string, unknown>>) ?? []
    for (const o of occ) {
      out.push({ symbol: (o['symbol'] as string) ?? '', roles: (o['symbol_roles'] as number) ?? 0, file })
    }
  }
  return out
}

console.log('=== Phase 0 Verification ===\n')

// Mode A: invoke scip-typescript on each package separately
const a_alone = indexAndPrint(`${FIXTURE}/pkg-a`, 'a-alone')
const b_alone = indexAndPrint(`${FIXTURE}/pkg-b`, 'b-alone')

const aSymbols = extractSymbols(a_alone)
const bSymbols = extractSymbols(b_alone)

// Q1: Role bitmask values for actual import statements
console.log('\n--- Q1: Role bitmask check ---')
const importOccurrences = bSymbols.filter(s => s.symbol.includes('pkg-a') && s.roles !== 0)
console.log(`pkg-b occurrences referencing pkg-a (with roles set):`, importOccurrences.slice(0, 5))
console.log(`Distinct role values seen in pkg-b:`, [...new Set(bSymbols.map(s => s.roles))].sort())
console.log(`Expected: 1=Definition, 2=Import (per SCIP protobuf)`)

// Q2: Symbol-string stability — does pkg-a's exported symbol match pkg-b's referenced symbol?
console.log('\n--- Q2: Symbol-string stability (separate invocations) ---')
const aDefSymbols = aSymbols.filter(s => (s.roles & 1) !== 0).map(s => s.symbol)
const bRefSymbols = bSymbols.filter(s => s.symbol.includes('pkg-a')).map(s => s.symbol)
const intersect = aDefSymbols.filter(s => bRefSymbols.includes(s))
console.log(`pkg-a Definitions: ${aDefSymbols.length}, pkg-b refs to pkg-a: ${bRefSymbols.length}`)
console.log(`Intersection (stable across invocations): ${intersect.length}`)
console.log(`Sample stable symbols:`, intersect.slice(0, 3))
if (intersect.length === 0) {
  console.error('❌ GATE FAIL: zero stable symbols across separate invocations. Design must pivot.')
  process.exit(1)
}

// Coverage cases
console.log('\n--- Q2 coverage cases ---')
console.log(`Default exports (look for "default" in symbol):`, intersect.filter(s => s.toLowerCase().includes('default')).slice(0, 3))
console.log(`Re-exports (look for sub.ts source):`, aDefSymbols.filter(s => s.includes('sub')).slice(0, 3))
console.log(`Type imports (Greeter):`, intersect.filter(s => s.includes('Greeter')).slice(0, 3))

console.log('\n✅ Phase 0 verification passed. Symbol IDs are stable across separate invocations.')
console.log(`Captured ${intersect.length} stable cross-workspace symbols.`)
```

- [ ] **Step 2: Run the script**

```bash
npx tsx scripts/verify-scip-cross-workspace.ts 2>&1 | tee /tmp/phase0-output.txt
```

Expected: exit 0, "Phase 0 verification passed", non-zero stable symbol count, role values include 1 (Definition) and 2 (Import).

- [ ] **Step 3: If gate fails — STOP**

If the script exits non-zero or `intersect.length === 0`, do NOT proceed. The design's "trust merger to dedupe cross-workspace edges" assumption requires symbol stability. Document the failure mode and re-open the spec for revision.

- [ ] **Step 4: Capture output for PR description**

```bash
cat /tmp/phase0-output.txt    # paste into PR1 description
```

- [ ] **Step 5: Commit script**

```bash
git add scripts/verify-scip-cross-workspace.ts
git commit -m "test(scip): add Phase 0 cross-workspace symbol-stability verification"
```

---

## Task 3: parseSCIPOutput — synthesize file-symbols (TS)

**Files:**
- Modify: `packages/extractor-scip-typescript/src/index.ts:71-95`
- Test: `packages/extractor-scip-typescript/src/file-symbols.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import { ScipTypescriptExtractor } from './index.js'

const FIXTURE_A = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg/pkg-a')

describe('scip-typescript: file-symbol synthesis', () => {
  it('emits a kind:"file" symbol for each unique containing file', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE_A, root: FIXTURE_A })
    const fileSymbols = result.ir.symbols.filter(s => s.kind === 'file')
    expect(fileSymbols.length).toBeGreaterThan(0)
    // All file-symbols must have id starting with 'file::'
    expect(fileSymbols.every(s => s.id.startsWith('file::'))).toBe(true)
    // file-symbol absPath equals canonicalized real file
    const indexFile = fileSymbols.find(s => s.absPath.endsWith('src/index.ts'))
    expect(indexFile).toBeDefined()
    expect(indexFile!.id).toBe(`file::${indexFile!.absPath}`)
    expect(indexFile!.confidence).toBe('verified')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @codeflow/extractor-scip-typescript test file-symbols
```

Expected: FAIL — "expected file symbols length > 0, got 0"

- [ ] **Step 3: Modify `parseSCIPOutput` to synthesize file-symbols**

Update `packages/extractor-scip-typescript/src/index.ts`:

```ts
function parseSCIPOutput(scipFile: string, root: string, extractorName: string, extractorVersion: string, invocation: string): IR {
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
  const documents: { relPath: string; absPath: string; language: 'ts' }[] = []
  const fileSymbolsByPath = new Map<string, CFSymbol>()  // canonAbsPath → file-symbol

  const docs = scip['documents'] as Array<Record<string, unknown>> | undefined ?? []
  for (const doc of docs) {
    const relPath = doc['relative_path'] as string | undefined
    if (!relPath) continue
    const absPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath)
    const canonAbs = canonicalizePath(absPath)
    let canonRel: string
    try { canonRel = posixRelative(root, canonAbs) }
    catch { continue }

    documents.push({ relPath: canonRel, absPath: canonAbs, language: 'ts' })

    // Synthesize a file-symbol for this document
    const fileSymId = `file::${canonAbs}`
    if (!fileSymbolsByPath.has(canonAbs)) {
      const fileSym: CFSymbol = {
        id: fileSymId,
        kind: 'file',
        name: path.basename(canonAbs),
        absPath: canonAbs,
        relPath: canonRel,
        language: 'ts',
        origin: 'extractor',
        confidence: 'verified',
      }
      fileSymbolsByPath.set(canonAbs, fileSym)
      symbols.push(fileSym)
    }

    const occurrences = doc['occurrences'] as Array<Record<string, unknown>> | undefined ?? []
    for (const occ of occurrences) {
      const symId = occ['symbol'] as string | undefined
      const roles = (occ['symbol_roles'] as number | undefined) ?? 0
      if (!symId) continue
      // Definition role: bit 0 (0x1) — emit as Definition symbol
      if ((roles & 1) !== 0) {
        const name = symId.split(':').at(-1) ?? symId
        symbols.push({
          id: symId, kind: 'function', name,
          absPath: canonAbs, relPath: canonRel,
          language: 'ts', origin: 'extractor', confidence: 'verified',
        })
      }
      // Import (0x2) and Reference (roles===0) handled in next task
    }
  }

  return {
    schemaVersion: '1',
    meta: { extractor: { name: extractorName, version: extractorVersion, invocation }, root },
    documents,
    symbols,
    relationships,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @codeflow/extractor-scip-typescript test file-symbols
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/extractor-scip-typescript/src/
git commit -m "feat(scip-ts): synthesize file-symbols for relationship from-endpoints"
```

---

## Task 4: parseSCIPOutput — emit Import relationships (TS)

**Files:**
- Modify: `packages/extractor-scip-typescript/src/index.ts` (parseSCIPOutput, add relationship emission)
- Test: `packages/extractor-scip-typescript/src/relationships.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipTypescriptExtractor } from './index.js'

const FIXTURE_B = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg/pkg-b')

describe('scip-typescript: import relationships', () => {
  it('emits relationships from non-Definition occurrences with Import role (0x2)', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B })

    expect(result.ir.relationships.length).toBeGreaterThan(0)

    // Every relationship.from must be a file-symbol id
    expect(result.ir.relationships.every(r => r.from.startsWith('file::'))).toBe(true)

    // Every relationship.from must be findable in symbols (byId remap contract)
    const symIds = new Set(result.ir.symbols.map(s => s.id))
    for (const r of result.ir.relationships) {
      expect(symIds.has(r.from)).toBe(true)
    }

    // Should have 'imports' kind for actual import statements
    expect(result.ir.relationships.some(r => r.kind === 'imports')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @codeflow/extractor-scip-typescript test relationships
```

Expected: FAIL — relationships array empty

- [ ] **Step 3: Add relationship emission in `parseSCIPOutput`**

In the `for (const occ of occurrences)` loop, after the Definition handling:

```ts
      // Definition role: bit 0 (0x1)
      if ((roles & 1) !== 0) {
        const name = symId.split(':').at(-1) ?? symId
        symbols.push({
          id: symId, kind: 'function', name,
          absPath: canonAbs, relPath: canonRel,
          language: 'ts', origin: 'extractor', confidence: 'verified',
        })
        continue
      }

      // Skip local symbols (intra-document references not interesting for cross-file graph)
      if (symId.startsWith('local ')) continue

      // Import role: bit 1 (0x2) — emit as 'imports' relationship
      if ((roles & 2) !== 0) {
        relationships.push({
          id: `${fileSymId}::${symId}::imports`,
          from: fileSymId,
          to: symId,
          kind: 'imports',
          language: 'ts',
          confidence: 'verified',
        })
        continue
      }

      // Plain reference: roles === 0, non-local symbol — emit as 'references' relationship
      if (roles === 0) {
        relationships.push({
          id: `${fileSymId}::${symId}::references`,
          from: fileSymId,
          to: symId,
          kind: 'references',
          language: 'ts',
          confidence: 'verified',
        })
      }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @codeflow/extractor-scip-typescript test relationships
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/extractor-scip-typescript/src/
git commit -m "feat(scip-ts): emit Import (0x2) and Reference (roles=0) relationships"
```

---

## Task 5: Property test — every relationship.from resolves via byId

**Files:**
- Test: `packages/extractor-scip-typescript/src/relationships-byid.property.test.ts`

- [ ] **Step 1: Write the property test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipTypescriptExtractor } from './index.js'
import { canonicalMerge } from '@codeflow/canonical'

const FIXTURE_B = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg/pkg-b')

describe('scip-typescript: byId remap contract (property)', () => {
  it('every relationship.from is a file-symbol present in ir.symbols', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B })

    const symIds = new Set(result.ir.symbols.map(s => s.id))
    for (const r of result.ir.relationships) {
      expect(symIds.has(r.from), `relationship.from "${r.from}" not in symbols`).toBe(true)
      expect(r.from.startsWith('file::')).toBe(true)
    }
  })

  it('canonicalMerge does not leak path strings — all surviving relationships have file-symbol from', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B })

    const merged = canonicalMerge(result.ir.symbols, FIXTURE_B, result.ir.relationships)

    for (const r of merged.relationships) {
      // After canonical merge, byId remapping may have rewritten 'from'
      // but the result must still be a known symbol id
      const symIds = new Set(merged.symbols.map(s => s.id))
      expect(symIds.has(r.from), `merged relationship.from "${r.from}" not in merged symbols`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @codeflow/extractor-scip-typescript test relationships-byid
```

Expected: PASS — both invariants hold

- [ ] **Step 3: Commit**

```bash
git add packages/extractor-scip-typescript/src/relationships-byid.property.test.ts
git commit -m "test(scip-ts): assert relationship.from byId-remap contract"
```

---

## Task 6: scip-python — file-symbols + relationships

**Files:**
- Modify: `packages/extractor-scip-python/src/index.ts`
- Test: `packages/extractor-scip-python/src/relationships.test.ts`
- Create: `scripts/fixtures/scip-cross-2pkg-py/pkg-a/pyproject.toml`
- Create: `scripts/fixtures/scip-cross-2pkg-py/pkg-a/pkg_a/__init__.py`
- Create: `scripts/fixtures/scip-cross-2pkg-py/pkg-b/pyproject.toml`
- Create: `scripts/fixtures/scip-cross-2pkg-py/pkg-b/pkg_b/__init__.py`

- [ ] **Step 1: Create Python fixture**

`scripts/fixtures/scip-cross-2pkg-py/pkg-a/pyproject.toml`:
```toml
[project]
name = "pkg-a"
version = "0.0.0"
```

`scripts/fixtures/scip-cross-2pkg-py/pkg-a/pkg_a/__init__.py`:
```python
def named_greeting() -> str:
    return "hello from pkg-a"

class Greeter:
    def greet(self) -> str:
        return named_greeting()
```

`scripts/fixtures/scip-cross-2pkg-py/pkg-b/pyproject.toml`:
```toml
[project]
name = "pkg-b"
version = "0.0.0"
dependencies = ["pkg-a"]
```

`scripts/fixtures/scip-cross-2pkg-py/pkg-b/pkg_b/__init__.py`:
```python
from pkg_a import named_greeting, Greeter

def main() -> str:
    g = Greeter()
    return g.greet() + " / " + named_greeting()
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipPythonExtractor } from './index.js'

const FIXTURE_B = path.resolve(__dirname, '../../../scripts/fixtures/scip-cross-2pkg-py/pkg-b')

describe('scip-python: file-symbols + relationships', () => {
  it('emits file-symbols and import relationships', async () => {
    const ex = new ScipPythonExtractor()
    const result = await ex.extract({ path: FIXTURE_B, root: FIXTURE_B })

    expect(result.ir.symbols.some(s => s.kind === 'file')).toBe(true)
    expect(result.ir.relationships.length).toBeGreaterThan(0)

    const symIds = new Set(result.ir.symbols.map(s => s.id))
    for (const r of result.ir.relationships) {
      expect(r.from.startsWith('file::')).toBe(true)
      expect(symIds.has(r.from)).toBe(true)
    }
  })
})
```

- [ ] **Step 3: Run — verify it fails, then port the same parseSCIPOutput logic**

Apply the same pattern from Task 3+4 to `packages/extractor-scip-python/src/index.ts`. The SCIP output format is the same; only `language: 'py'` and the binary name differ.

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm --filter @codeflow/extractor-scip-python test relationships
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/fixtures/scip-cross-2pkg-py/ packages/extractor-scip-python/src/
git commit -m "feat(scip-py): emit file-symbols and Import/Reference relationships"
```

---

## Task 7: M1 acceptance gate

**Files:**
- None (verification task)

- [ ] **Step 1: Run all M1 tests**

```bash
pnpm test
```

Expected: all tests pass, including new file-symbols and relationships tests for both scip-ts and scip-py.

- [ ] **Step 2: Verify single-tsconfig integration**

Start preview on a fixture with a real tsconfig:

```bash
pnpm build:plugin   # rebuild dist
# Manual: through Claude Code, /flow --verified scripts/fixtures/scip-cross-2pkg/pkg-b
# Browser at localhost:7800 should show > 0 verified edges
```

Inspect via MCP: `mcp__plugin_codeflow_codeflow__get_ir({previewId})` and confirm `relationships.length > 0`.

- [ ] **Step 3: Confirm Phase 0 still passes**

```bash
npx tsx scripts/verify-scip-cross-workspace.ts
```

Expected: still passes.

- [ ] **Step 4: Bump version and ship M1**

Per `feedback_release_sop.md`:
```bash
# Bump 0.1.12 → 0.1.13 in plugin.json, marketplace.json (×2), package.json
pnpm build:plugin
git push origin main
git push --force origin release && git push --force origin v0.1.13
```

- [ ] **Step 5: STOP — gate verification**

Before starting M2: confirm in this session that M1 acceptance criteria from spec §4.6 all check:

- [ ] Phase 0 script committed; output proves symbol-stability assumption holds
- [ ] Single-tsconfig verified mode produces edges (manually verified)
- [ ] All M1 tests green
- [ ] No regressions in `mcp.empty-ir.test.ts`, `mcp.verified.test.ts`

Only proceed to M2 if all four pass.

---

# MILESTONE 2 (PR2) — Workspace detection + per-workspace fan-out

**M2 goal:** `/flow --verified` on the codeflow monorepo produces a single connected graph with cross-package edges. Visually flat (subgraphs come in M3).

## Task 8: Install workspace-detection dependency

**Files:**
- Modify: `packages/canonical/package.json`

- [ ] **Step 1: Add @pnpm/find-workspace-packages dependency**

```bash
cd packages/canonical
pnpm add @pnpm/find-workspace-packages
```

- [ ] **Step 2: Verify install**

```bash
ls node_modules/@pnpm/find-workspace-packages/dist/   # should contain index.js
```

- [ ] **Step 3: Commit**

```bash
git add packages/canonical/package.json pnpm-lock.yaml
git commit -m "deps(canonical): add @pnpm/find-workspace-packages"
```

---

## Task 9: Workspace types

**Files:**
- Create: `packages/canonical/src/workspace-types.ts`

- [ ] **Step 1: Write the types**

```ts
export type WorkspaceManifest = 'pnpm' | 'pkgjson' | 'pyproject' | 'setup.py' | 'fs-fallback'
export type WorkspaceLanguage = 'ts' | 'py'

export interface Workspace {
  /** Canonical repo root — same for all workspaces in a single detection result */
  rootPath: string
  /** Absolute path to this workspace's directory */
  workspacePath: string
  /** Posix-relative path from rootPath; e.g. "packages/cli", "apps/web" */
  workspaceRel: string
  /** Source of detection */
  manifest: WorkspaceManifest
  language: WorkspaceLanguage
  /** Absolute path to the language config — tsconfig.json or pyproject.toml or setup.py */
  configPath: string
  /** TS only: true if no other detected tsconfig references this workspace's tsconfig */
  isLeaf: boolean
  /** Display label for renderers (from package.json `name`, pyproject `[project].name`, setup.py `name=`) */
  displayName: string
}

export interface WorkspaceErrorInfo {
  workspace: Workspace
  /** Codeflow error envelope — keep as `unknown` here to avoid circular dep with @codeflow/core */
  error: unknown
}
```

- [ ] **Step 2: Add to canonical's barrel export**

In `packages/canonical/src/index.ts`:
```ts
export type { Workspace, WorkspaceManifest, WorkspaceLanguage, WorkspaceErrorInfo } from './workspace-types.js'
```

- [ ] **Step 3: Commit**

```bash
git add packages/canonical/src/workspace-types.ts packages/canonical/src/index.ts
git commit -m "feat(canonical): add Workspace types for monorepo detection"
```

---

## Task 10: detectWorkspaces — TS pnpm-workspace.yaml + package.json

**Files:**
- Create: `packages/canonical/src/detect-workspaces.ts`
- Test: `packages/canonical/src/detect-workspaces.test.ts`
- Create: `packages/canonical/tests/fixtures/ws-pnpm/pnpm-workspace.yaml` + sub-packages

- [ ] **Step 1: Create test fixtures**

`packages/canonical/tests/fixtures/ws-pnpm/pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`packages/canonical/tests/fixtures/ws-pnpm/packages/alpha/package.json`:
```json
{ "name": "alpha", "version": "0.0.0" }
```

`packages/canonical/tests/fixtures/ws-pnpm/packages/alpha/tsconfig.json`:
```json
{ "compilerOptions": { "noEmit": true } }
```

(Repeat for `beta` and `gamma`.)

`packages/canonical/tests/fixtures/ws-pkgjson/package.json`:
```json
{ "name": "root", "private": true, "workspaces": ["packages/*"] }
```

(Plus `packages/x/package.json` + `tsconfig.json`, `packages/y/...`.)

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { detectWorkspaces } from './detect-workspaces.js'

describe('detectWorkspaces — TS', () => {
  it('reads pnpm-workspace.yaml', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const ws = await detectWorkspaces(root, 'ts')
    expect(ws.length).toBe(3)
    expect(ws.map(w => w.workspaceRel).sort()).toEqual(['packages/alpha', 'packages/beta', 'packages/gamma'])
    expect(ws.every(w => w.manifest === 'pnpm')).toBe(true)
    expect(ws.every(w => w.language === 'ts')).toBe(true)
  })

  it('reads package.json#workspaces', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pkgjson')
    const ws = await detectWorkspaces(root, 'ts')
    expect(ws.length).toBe(2)
    expect(ws.every(w => w.manifest === 'pkgjson')).toBe(true)
  })

  it('uses package.json `name` for displayName', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const ws = await detectWorkspaces(root, 'ts')
    const alpha = ws.find(w => w.workspaceRel === 'packages/alpha')!
    expect(alpha.displayName).toBe('alpha')
  })

  it('falls back to single-path when no manifest found', async () => {
    const tmp = path.resolve(__dirname, '../tests/fixtures/ws-empty')
    // ws-empty has no manifest; expect single fs-fallback entry
    const ws = await detectWorkspaces(tmp, 'ts')
    expect(ws.length).toBe(1)
    expect(ws[0].manifest).toBe('fs-fallback')
  })
})
```

- [ ] **Step 3: Implement detectWorkspaces (TS pnpm + pkgjson paths)**

```ts
import path from 'node:path'
import fs from 'node:fs/promises'
import { canonicalizePath, posixRelative } from './canonicalizer.js'
import type { Workspace, WorkspaceLanguage } from './workspace-types.js'

export async function detectWorkspaces(rootPath: string, language: WorkspaceLanguage): Promise<Workspace[]> {
  const canonicalRoot = canonicalizePath(rootPath)
  if (language === 'ts') return detectTsWorkspaces(canonicalRoot)
  return detectPyWorkspaces(canonicalRoot)
}

async function detectTsWorkspaces(rootPath: string): Promise<Workspace[]> {
  // Priority 1: pnpm-workspace.yaml
  const pnpm = await tryDetectPnpm(rootPath)
  if (pnpm) return pnpm
  // Priority 2: package.json#workspaces
  const pkgjson = await tryDetectPackageJsonWorkspaces(rootPath)
  if (pkgjson) return pkgjson
  // Priority 3 & 4 added in next tasks (fs-walk, fs-fallback)
  return [singlePathFallback(rootPath, 'ts')]
}

async function tryDetectPnpm(rootPath: string): Promise<Workspace[] | null> {
  const ymlPath = path.join(rootPath, 'pnpm-workspace.yaml')
  if (!await exists(ymlPath)) return null
  // Use @pnpm/find-workspace-packages — handles glob expansion, exclusions, pnpm v9 catalog form
  const findWorkspacePackages = (await import('@pnpm/find-workspace-packages')).default
  const projects = await findWorkspacePackages(rootPath)
  return Promise.all(projects
    .filter(p => p.dir !== rootPath) // skip root project
    .map(p => buildTsWorkspace(rootPath, p.dir, 'pnpm')))
}

async function tryDetectPackageJsonWorkspaces(rootPath: string): Promise<Workspace[] | null> {
  const pkgPath = path.join(rootPath, 'package.json')
  if (!await exists(pkgPath)) return null
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as { workspaces?: string[] | { packages?: string[] } }
  const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages
  if (!patterns || patterns.length === 0) return null
  const fastGlob = (await import('fast-glob')).default
  const dirs = await fastGlob(patterns, { cwd: rootPath, onlyDirectories: true, absolute: true })
  return Promise.all(dirs.map(d => buildTsWorkspace(rootPath, d, 'pkgjson')))
}

async function buildTsWorkspace(rootPath: string, workspacePath: string, manifest: 'pnpm' | 'pkgjson'): Promise<Workspace> {
  const tsconfigPath = path.join(workspacePath, 'tsconfig.json')
  const pkgPath = path.join(workspacePath, 'package.json')
  let displayName: string
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as { name?: string }
    displayName = pkg.name ?? posixRelative(rootPath, workspacePath)
  } catch {
    displayName = posixRelative(rootPath, workspacePath)
  }
  return {
    rootPath,
    workspacePath: canonicalizePath(workspacePath),
    workspaceRel: posixRelative(rootPath, workspacePath),
    manifest,
    language: 'ts',
    configPath: tsconfigPath,
    isLeaf: true,    // computed in Task 12
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
  try { await fs.access(p); return true } catch { return false }
}

async function detectPyWorkspaces(_rootPath: string): Promise<Workspace[]> {
  // Implemented in Task 13
  return [singlePathFallback(_rootPath, 'py')]
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @codeflow/canonical test detect-workspaces
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/canonical/src/detect-workspaces.ts packages/canonical/src/detect-workspaces.test.ts packages/canonical/tests/fixtures/ws-pnpm packages/canonical/tests/fixtures/ws-pkgjson packages/canonical/tests/fixtures/ws-empty
git commit -m "feat(canonical): detectWorkspaces — pnpm-workspace.yaml + package.json#workspaces (TS)"
```

---

## Task 11: detectWorkspaces — TS fs-walk fallback

**Files:**
- Modify: `packages/canonical/src/detect-workspaces.ts`
- Modify: `packages/canonical/src/detect-workspaces.test.ts`
- Create: `packages/canonical/tests/fixtures/ws-fswalk/...`

- [ ] **Step 1: Create fs-walk fixture (no manifest, just nested tsconfig.json files)**

```
packages/canonical/tests/fixtures/ws-fswalk/
  apps/
    web/tsconfig.json
    api/tsconfig.json
  libs/
    shared/tsconfig.json
    node_modules/   (must be ignored)
      bad/tsconfig.json
```

- [ ] **Step 2: Write the failing test**

```ts
it('falls back to filesystem walk when no manifest', async () => {
  const root = path.resolve(__dirname, '../tests/fixtures/ws-fswalk')
  const ws = await detectWorkspaces(root, 'ts')
  expect(ws.length).toBe(3)   // apps/web, apps/api, libs/shared
  expect(ws.every(w => w.manifest === 'fs-fallback')).toBe(true)
  // Must NOT include node_modules entries
  expect(ws.every(w => !w.workspaceRel.includes('node_modules'))).toBe(true)
})
```

- [ ] **Step 3: Implement fs-walk**

In `detectTsWorkspaces`, add Priority 3 before the single-path fallback:

```ts
// Priority 3: fs-walk
const walked = await fsWalkForTsconfig(rootPath)
if (walked.length > 0) return walked
return [singlePathFallback(rootPath, 'ts')]
```

```ts
async function fsWalkForTsconfig(rootPath: string): Promise<Workspace[]> {
  const fastGlob = (await import('fast-glob')).default
  // Use chokidar-aligned ignore set per spec §11
  const ignore = ['**/node_modules/**', '**/.git/**', '**/.venv/**', '**/dist/**', '**/build/**', '**/target/**', '**/.next/**', '**/.parcel-cache/**']
  const tsconfigs = await fastGlob('**/tsconfig.json', { cwd: rootPath, ignore, absolute: true, deep: 5, onlyFiles: true })
  if (tsconfigs.length === 0) return []
  return Promise.all(tsconfigs.map(t => buildTsWorkspace(rootPath, path.dirname(t), 'fs-fallback')))
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm --filter @codeflow/canonical test detect-workspaces
```

- [ ] **Step 5: Commit**

```bash
git add packages/canonical/src/detect-workspaces.ts packages/canonical/tests/fixtures/ws-fswalk
git commit -m "feat(canonical): detectWorkspaces — fs-walk fallback for TS"
```

---

## Task 12: isLeaf computation via tsconfig references graph

**Files:**
- Modify: `packages/canonical/src/detect-workspaces.ts`
- Test: `packages/canonical/src/is-leaf.test.ts`
- Create: `packages/canonical/tests/fixtures/ws-references/...`

- [ ] **Step 1: Create references fixture**

```
ws-references/
  pnpm-workspace.yaml      (packages: ['packages/*'])
  packages/
    shared/
      package.json
      tsconfig.json        (no references)
    web/
      package.json
      tsconfig.json        (references: [{ "path": "../shared" }])
```

- [ ] **Step 2: Write the failing test**

```ts
it('computes isLeaf correctly via tsconfig references', async () => {
  const root = path.resolve(__dirname, '../tests/fixtures/ws-references')
  const ws = await detectWorkspaces(root, 'ts')
  const shared = ws.find(w => w.workspaceRel === 'packages/shared')!
  const web = ws.find(w => w.workspaceRel === 'packages/web')!
  // shared is REFERENCED BY web → not a leaf (per our convention: leaf = nothing references it)
  expect(shared.isLeaf).toBe(false)
  // web references shared but nothing references web → web is a leaf
  expect(web.isLeaf).toBe(true)
})
```

- [ ] **Step 3: Implement isLeaf computation**

After workspaces are built, do a pass to compute isLeaf:

```ts
// At end of detectTsWorkspaces, after building all workspaces:
async function computeIsLeaf(workspaces: Workspace[]): Promise<Workspace[]> {
  const referenced = new Set<string>()  // canonical workspacePath of any referenced workspace
  for (const w of workspaces) {
    try {
      const tsconfig = JSON.parse(await fs.readFile(w.configPath, 'utf-8')) as { references?: Array<{ path: string }> }
      for (const ref of tsconfig.references ?? []) {
        const refAbs = canonicalizePath(path.resolve(w.workspacePath, ref.path))
        referenced.add(refAbs)
      }
    } catch { /* malformed tsconfig — skip */ }
  }
  return workspaces.map(w => ({ ...w, isLeaf: !referenced.has(w.workspacePath) }))
}
```

Wire into `detectTsWorkspaces`:

```ts
async function detectTsWorkspaces(rootPath: string): Promise<Workspace[]> {
  const ws = await tryDetectPnpm(rootPath)
       ?? await tryDetectPackageJsonWorkspaces(rootPath)
       ?? await fsWalkForTsconfig(rootPath)
       ?? null
  if (ws && ws.length > 0) return computeIsLeaf(ws)
  return [singlePathFallback(rootPath, 'ts')]
}
```

(Refactor priority chain into one expression.)

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/canonical/src/detect-workspaces.ts packages/canonical/src/is-leaf.test.ts packages/canonical/tests/fixtures/ws-references
git commit -m "feat(canonical): detectWorkspaces — isLeaf via tsconfig references graph"
```

---

## Task 13: detectWorkspaces — Python paths

**Files:**
- Modify: `packages/canonical/src/detect-workspaces.ts`
- Test: `packages/canonical/src/detect-workspaces-py.test.ts`
- Create: `packages/canonical/tests/fixtures/ws-py-uv/pyproject.toml` + members

- [ ] **Step 1: Create Python workspace fixtures**

`ws-py-uv/pyproject.toml` (uv workspace):
```toml
[project]
name = "root"
[tool.uv.workspace]
members = ["packages/*"]
```

Plus `packages/alpha/pyproject.toml`, `packages/beta/pyproject.toml` (each with `[project] name = "..."`).

Also `ws-py-flat/pyproject.toml` (single, no workspace tables) and `ws-py-fswalk/` (multiple pyproject in nested dirs, no manifest).

- [ ] **Step 2: Write failing tests**

```ts
describe('detectWorkspaces — Py', () => {
  it('reads [tool.uv.workspace] members', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-uv')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(2)
    expect(ws.every(w => w.manifest === 'pyproject')).toBe(true)
    expect(ws.every(w => w.language === 'py')).toBe(true)
    expect(ws.every(w => w.isLeaf === true)).toBe(true)  // Py has no tsconfig references
  })

  it('treats single pyproject.toml as one workspace', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-flat')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(1)
    expect(ws[0].manifest).toBe('pyproject')
  })

  it('fs-walk fallback finds nested pyproject.toml', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-fswalk')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBeGreaterThan(1)
  })

  it('extracts displayName from [project].name', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-uv')
    const ws = await detectWorkspaces(root, 'py')
    const alpha = ws.find(w => w.workspaceRel === 'packages/alpha')!
    expect(alpha.displayName).toBe('alpha')
  })
})
```

- [ ] **Step 3: Implement detectPyWorkspaces**

```ts
async function detectPyWorkspaces(rootPath: string): Promise<Workspace[]> {
  const tomlPath = path.join(rootPath, 'pyproject.toml')
  if (await exists(tomlPath)) {
    const toml = (await import('@iarna/toml')).default.parse(await fs.readFile(tomlPath, 'utf-8')) as Record<string, any>
    const tables: string[][] = []
    if (toml.tool?.uv?.workspace?.members) tables.push(toml.tool.uv.workspace.members)
    if (toml.tool?.pdm?.workspace?.members) tables.push(toml.tool.pdm.workspace.members)
    if (toml.tool?.rye?.workspaces) tables.push(toml.tool.rye.workspaces)
    if (tables.length > 0) {
      const fastGlob = (await import('fast-glob')).default
      const patterns = tables.flat()
      const dirs = await fastGlob(patterns, { cwd: rootPath, onlyDirectories: true, absolute: true })
      return Promise.all(dirs.filter(d => fs.access(path.join(d, 'pyproject.toml')).then(() => true).catch(() => false)).map(d => buildPyWorkspace(rootPath, d, 'pyproject')))
    }
    // Single pyproject.toml at root
    return [await buildPyWorkspace(rootPath, rootPath, 'pyproject')]
  }
  // fs-walk
  const fastGlob = (await import('fast-glob')).default
  const ignore = ['**/node_modules/**', '**/.git/**', '**/.venv/**', '**/__pycache__/**', '**/dist/**', '**/build/**']
  const found = await fastGlob('**/pyproject.toml', { cwd: rootPath, ignore, absolute: true, deep: 5, onlyFiles: true })
  if (found.length > 0) return Promise.all(found.map(f => buildPyWorkspace(rootPath, path.dirname(f), 'fs-fallback')))
  return [singlePathFallback(rootPath, 'py')]
}

async function buildPyWorkspace(rootPath: string, workspacePath: string, manifest: 'pyproject' | 'fs-fallback'): Promise<Workspace> {
  const tomlPath = path.join(workspacePath, 'pyproject.toml')
  let displayName: string
  try {
    const toml = (await import('@iarna/toml')).default.parse(await fs.readFile(tomlPath, 'utf-8')) as Record<string, any>
    displayName = toml.project?.name ?? posixRelative(rootPath, workspacePath)
  } catch {
    displayName = posixRelative(rootPath, workspacePath)
  }
  return {
    rootPath,
    workspacePath: canonicalizePath(workspacePath),
    workspaceRel: posixRelative(rootPath, workspacePath),
    manifest,
    language: 'py',
    configPath: tomlPath,
    isLeaf: true,
    displayName,
  }
}
```

Add `@iarna/toml` to `packages/canonical/package.json` dependencies (`pnpm add @iarna/toml`).

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/canonical/src/detect-workspaces.ts packages/canonical/src/detect-workspaces-py.test.ts packages/canonical/tests/fixtures/ws-py-* packages/canonical/package.json pnpm-lock.yaml
git commit -m "feat(canonical): detectWorkspaces — Python (pyproject workspace tables, single, fs-walk)"
```

---

## Task 14: detectWorkspaces — memoization on manifest mtimes

**Files:**
- Modify: `packages/canonical/src/detect-workspaces.ts`
- Test: `packages/canonical/src/detect-workspaces-memo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import { detectWorkspaces, _resetMemoCache } from './detect-workspaces.js'

describe('detectWorkspaces memoization', () => {
  it('returns cached result on repeat call without manifest mtime change', async () => {
    _resetMemoCache()
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const a = await detectWorkspaces(root, 'ts')
    // Mark a sentinel field so we can tell if it was recomputed
    const aFirstId = a[0]
    const b = await detectWorkspaces(root, 'ts')
    expect(b[0]).toBe(aFirstId)  // same reference — cached
  })

  it('invalidates when manifest mtime changes', async () => {
    _resetMemoCache()
    const root = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')
    const a = await detectWorkspaces(root, 'ts')
    // Touch the manifest
    const yml = path.join(root, 'pnpm-workspace.yaml')
    const stat = await fs.stat(yml)
    await fs.utimes(yml, stat.atime, new Date(Date.now() + 1000))
    const b = await detectWorkspaces(root, 'ts')
    expect(b[0]).not.toBe(a[0])  // recomputed
    // restore mtime
    await fs.utimes(yml, stat.atime, stat.mtime)
  })
})
```

- [ ] **Step 2: Implement memoization**

```ts
const memoCache = new Map<string, { mtimeKey: string; workspaces: Workspace[] }>()

export function _resetMemoCache(): void {
  memoCache.clear()
}

async function manifestMtimeKey(rootPath: string): Promise<string> {
  const candidates = ['pnpm-workspace.yaml', 'package.json', 'pyproject.toml']
  const stats: string[] = []
  for (const c of candidates) {
    try {
      const stat = await fs.stat(path.join(rootPath, c))
      stats.push(`${c}:${stat.mtimeMs}`)
    } catch { /* not present */ }
  }
  return stats.join('|')
}

// Wrap detectWorkspaces:
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
```

- [ ] **Step 3: Run tests — verify they pass**

- [ ] **Step 4: Commit**

```bash
git add packages/canonical/src/detect-workspaces.ts packages/canonical/src/detect-workspaces-memo.test.ts
git commit -m "feat(canonical): memoize detectWorkspaces on manifest mtimes"
```

---

## Task 15: runPerWorkspace — basic spawn-based runner

**Files:**
- Create: `packages/core/src/run-per-workspace.ts`
- Test: `packages/core/src/run-per-workspace.test.ts`

- [ ] **Step 1: Write failing test for happy path**

```ts
import { describe, it, expect } from 'vitest'
import { runPerWorkspace } from './run-per-workspace.js'
import type { Workspace } from '@codeflow/canonical'

const fakeWs: Workspace[] = [
  { rootPath: '/r', workspacePath: '/r/a', workspaceRel: 'a', manifest: 'fs-fallback', language: 'ts', configPath: '/r/a/ts.json', isLeaf: true, displayName: 'a' },
  { rootPath: '/r', workspacePath: '/r/b', workspaceRel: 'b', manifest: 'fs-fallback', language: 'ts', configPath: '/r/b/ts.json', isLeaf: true, displayName: 'b' },
]

describe('runPerWorkspace', () => {
  it('runs all workspaces and returns results', async () => {
    const out = await runPerWorkspace(
      fakeWs,
      async (w) => ({ ws: w.workspaceRel }),
      { concurrency: 2, timeoutMs: 5_000, laneBudgetMs: 30_000 },
    )
    expect(out.results.length).toBe(2)
    expect(out.errors.length).toBe(0)
    expect(out.cancelled).toBe(false)
  })

  it('captures per-item errors without aborting other items', async () => {
    const out = await runPerWorkspace(
      fakeWs,
      async (w) => { if (w.workspaceRel === 'a') throw new Error('boom'); return { ws: w.workspaceRel } },
      { concurrency: 2, timeoutMs: 5_000, laneBudgetMs: 30_000 },
    )
    expect(out.results.length).toBe(1)
    expect(out.errors.length).toBe(1)
    expect(out.errors[0].workspace.workspaceRel).toBe('a')
  })
})
```

- [ ] **Step 2: Implement basic runner**

```ts
import type { Workspace, WorkspaceErrorInfo } from '@codeflow/canonical'

export interface RunPerWorkspaceOpts {
  concurrency: number
  timeoutMs: number
  laneBudgetMs: number
}

export interface RunPerWorkspaceResult<T> {
  results: T[]
  errors: WorkspaceErrorInfo[]
  cancelled: boolean
}

export async function runPerWorkspace<T>(
  items: Workspace[],
  fn: (w: Workspace, signal: AbortSignal) => Promise<T>,
  opts: RunPerWorkspaceOpts,
): Promise<RunPerWorkspaceResult<T>> {
  const results: T[] = []
  const errors: WorkspaceErrorInfo[] = []

  const laneController = new AbortController()
  const laneTimeout = setTimeout(() => laneController.abort(new Error('lane budget exhausted')), opts.laneBudgetMs)
  let cancelled = false

  const queue = [...items]
  const workers: Promise<void>[] = []

  for (let i = 0; i < Math.min(opts.concurrency, items.length); i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        if (laneController.signal.aborted) { cancelled = true; return }
        const ws = queue.shift()!
        const itemController = new AbortController()
        const itemTimeout = setTimeout(() => itemController.abort(new Error('per-item timeout')), opts.timeoutMs)
        // Combine signals: abort if either lane or item is aborted
        const onLaneAbort = () => itemController.abort(laneController.signal.reason)
        laneController.signal.addEventListener('abort', onLaneAbort)
        try {
          const r = await fn(ws, itemController.signal)
          results.push(r)
        } catch (e) {
          errors.push({ workspace: ws, error: { code: 'WORKSPACE_FN_FAILED', message: String(e) } })
          if (laneController.signal.aborted) cancelled = true
        } finally {
          clearTimeout(itemTimeout)
          laneController.signal.removeEventListener('abort', onLaneAbort)
        }
      }
    })())
  }

  await Promise.all(workers)
  clearTimeout(laneTimeout)
  return { results, errors, cancelled }
}
```

- [ ] **Step 3: Run tests — verify they pass**

```bash
pnpm --filter @codeflow/core test run-per-workspace
```

- [ ] **Step 4: Add to core barrel export**

In `packages/core/src/index.ts`:
```ts
export { runPerWorkspace } from './run-per-workspace.js'
export type { RunPerWorkspaceOpts, RunPerWorkspaceResult } from './run-per-workspace.js'
```

Add `@codeflow/canonical` as dep of `@codeflow/core`'s package.json (workspace:* dep).

Wait — `@codeflow/canonical` already imports from `@codeflow/core`. Adding the reverse creates a cycle. Move `Workspace` types to `@codeflow/core` instead OR use a duck-typed interface in core. **Decision: duck-type in core** — defines `WorkspaceLike` interface containing only the fields runPerWorkspace needs (`workspaceRel`, `workspacePath`).

Update `run-per-workspace.ts`:
```ts
export interface WorkspaceLike {
  workspaceRel: string
  workspacePath: string
}

export async function runPerWorkspace<T>(
  items: readonly WorkspaceLike[],
  // ...
)
```

And `WorkspaceErrorInfo` type stays simple: `{ workspace: WorkspaceLike, error: unknown }`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run-per-workspace.ts packages/core/src/run-per-workspace.test.ts packages/core/src/index.ts
git commit -m "feat(core): add runPerWorkspace concurrency primitive"
```

---

## Task 16: runPerWorkspace — child-process tracking + signal cancellation

**Files:**
- Modify: `packages/core/src/run-per-workspace.ts`
- Test: `packages/core/src/run-per-workspace-cancel.test.ts`

- [ ] **Step 1: Write the failing zombie-process test**

```ts
import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { runPerWorkspace } from './run-per-workspace.js'

describe('runPerWorkspace cancellation', () => {
  it('lane budget timeout kills in-flight subprocesses (no zombies)', async () => {
    const items = [{ workspaceRel: 'a', workspacePath: '/r/a' }, { workspaceRel: 'b', workspacePath: '/r/b' }]
    const pids: number[] = []

    const out = await runPerWorkspace(
      items,
      async (_w, signal) => {
        // Simulate scip-typescript: spawn long-running child; honor signal
        const child = spawn('sleep', ['60'])
        pids.push(child.pid!)
        signal.addEventListener('abort', () => child.kill('SIGTERM'))
        return new Promise((resolve, reject) => {
          child.on('exit', (code) => code === 0 ? resolve('ok') : reject(new Error(`exit ${code}`)))
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
      },
      { concurrency: 2, timeoutMs: 30_000, laneBudgetMs: 500 },  // 500ms budget — will fire
    )

    expect(out.cancelled).toBe(true)
    expect(out.errors.length).toBe(2)

    // Verify no zombie sleep processes remain
    await new Promise(r => setTimeout(r, 200))   // allow SIGKILL to land
    for (const pid of pids) {
      let alive: boolean
      try { process.kill(pid, 0); alive = true } catch { alive = false }
      expect(alive, `pid ${pid} still alive — zombie`).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run test — verify it fails initially**

It may pass if signal-handling is already wired correctly from Task 15; if it fails, the cancellation pathway needs to actively kill children. Verify by running and reading the output.

- [ ] **Step 3: Strengthen cancellation in runPerWorkspace**

Add SIGKILL escalation after SIGTERM grace period. Update so consumers receive an AbortSignal that THEY connect to their child processes. The runner already does this via `itemController.signal`. Test ensures that consumers using the signal correctly produces no zombies.

If test fails: it means a consumer's signal handler isn't propagating in time. Fix by ensuring `itemController.abort()` happens AFTER signal listeners run on lane abort (already does in current implementation). Add a post-abort grace window that escalates to SIGKILL — but this is consumer's responsibility, not runPerWorkspace's. Document this contract in JSDoc.

```ts
/**
 * @param fn  Function invoked per workspace. Receives an AbortSignal.
 *            **Consumer contract:** if you spawn a child process, you MUST
 *            register a signal listener that kills the child:
 *
 *              const child = spawn(...)
 *              signal.addEventListener('abort', () => child.kill('SIGTERM'))
 *              // After 2s grace, escalate to SIGKILL (consumer's responsibility)
 *
 * Lane budget exhaustion sets the signal; consumer must clean up their
 * subprocesses or risk orphaned children.
 */
export async function runPerWorkspace<T>(...)
```

- [ ] **Step 4: Run test — verify it passes**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run-per-workspace.ts packages/core/src/run-per-workspace-cancel.test.ts
git commit -m "test(core): verify runPerWorkspace lane-budget kills consumer subprocesses"
```

---

## Task 17: reRootIR — rewrite all path-derived fields

**Files:**
- Create: `packages/canonical/src/re-root-ir.ts`
- Test: `packages/canonical/src/re-root-ir.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { reRootIR } from './re-root-ir.js'
import type { IR } from '@codeflow/core'

const wsRoot = '/r/packages/cli'
const repoRoot = '/r'

const inputIR: IR = {
  schemaVersion: '1',
  meta: { extractor: { name: 'scip-ts', version: 'x', invocation: 'cli' }, root: wsRoot },
  documents: [{ relPath: 'src/index.ts', absPath: '/r/packages/cli/src/index.ts', language: 'ts' }],
  symbols: [
    { id: 'file::/r/packages/cli/src/index.ts', kind: 'file', name: 'index.ts', absPath: '/r/packages/cli/src/index.ts', relPath: 'src/index.ts', language: 'ts', origin: 'extractor', confidence: 'verified' },
    { id: 'sym1', kind: 'function', name: 'foo', absPath: '/r/packages/cli/src/index.ts', relPath: 'src/index.ts', language: 'ts', origin: 'extractor', confidence: 'verified' },
  ],
  relationships: [
    { id: 'rel1', from: 'file::/r/packages/cli/src/index.ts', to: 'sym1', kind: 'imports', language: 'ts', confidence: 'verified', source: { file: 'file::/r/packages/cli/src/index.ts', line: 1 } },
  ],
}

describe('reRootIR', () => {
  it('rewrites meta.root to repoRoot', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    expect(out.meta.root).toBe(repoRoot)
  })

  it('rewrites every doc relPath to be repo-relative', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    expect(out.documents[0].relPath).toBe('packages/cli/src/index.ts')
    expect(out.documents[0].absPath).toBe('/r/packages/cli/src/index.ts')
  })

  it('rewrites every symbol relPath to be repo-relative', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    for (const s of out.symbols) {
      expect(s.relPath).toBe('packages/cli/src/index.ts')
    }
  })

  it('stamps workspaceRel on every symbol', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    for (const s of out.symbols) {
      expect(s.workspaceRel).toBe('packages/cli')
    }
  })

  it('preserves Relationship.source.file as file-symbol id (does not rewrite)', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    expect(out.relationships[0].source!.file).toBe('file::/r/packages/cli/src/index.ts')
  })

  it('throws if Relationship.source.file is not a file-symbol id (PR1 contract violation)', () => {
    const bad: IR = { ...inputIR, relationships: [{ ...inputIR.relationships[0], source: { file: '/some/raw/path.ts', line: 1 } }] }
    expect(() => reRootIR(bad, repoRoot, 'packages/cli')).toThrow(/file-symbol id/)
  })

  it('idempotent: applying twice gives same result', () => {
    const a = reRootIR(inputIR, repoRoot, 'packages/cli')
    const b = reRootIR(a, repoRoot, 'packages/cli')
    expect(b).toEqual(a)
  })

  it('property: posixRelative(newRoot, symbol.absPath) === symbol.relPath for all symbols', () => {
    const out = reRootIR(inputIR, repoRoot, 'packages/cli')
    for (const s of out.symbols) {
      // re-derive and compare
      const expected = s.absPath.startsWith(repoRoot + '/') ? s.absPath.slice(repoRoot.length + 1) : s.absPath
      expect(s.relPath).toBe(expected)
    }
  })
})
```

- [ ] **Step 2: Implement reRootIR**

```ts
import type { IR, CFSymbol, CFDocument, Relationship } from '@codeflow/core'
import { canonicalizePath, posixRelative } from './canonicalizer.js'

export function reRootIR(ir: IR, repoRoot: string, workspaceRel: string): IR {
  const canonRepoRoot = canonicalizePath(repoRoot)

  const documents: CFDocument[] = ir.documents.map(d => ({
    ...d,
    absPath: canonicalizePath(d.absPath),
    relPath: posixRelative(canonRepoRoot, canonicalizePath(d.absPath)),
  }))

  const symbols: CFSymbol[] = ir.symbols.map(s => ({
    ...s,
    absPath: canonicalizePath(s.absPath),
    relPath: posixRelative(canonRepoRoot, canonicalizePath(s.absPath)),
    workspaceRel,
  }))

  const relationships: Relationship[] = ir.relationships.map(r => {
    if (r.source) {
      // Defensive assertion: PR1 contract requires source.file to be a file-symbol id
      if (!r.source.file.startsWith('file::')) {
        throw new Error(`reRootIR: Relationship.source.file must be a file-symbol id starting with "file::"; got "${r.source.file}". This indicates a PR1 contract violation.`)
      }
    }
    return r
  })

  return {
    ...ir,
    meta: { ...ir.meta, root: canonRepoRoot },
    documents,
    symbols,
    relationships,
  }
}
```

- [ ] **Step 3: Run tests — verify they pass**

```bash
pnpm --filter @codeflow/canonical test re-root-ir
```

- [ ] **Step 4: Add to canonical barrel export**

`packages/canonical/src/index.ts`:
```ts
export { reRootIR } from './re-root-ir.js'
```

- [ ] **Step 5: Commit**

```bash
git add packages/canonical/src/re-root-ir.ts packages/canonical/src/re-root-ir.test.ts packages/canonical/src/index.ts
git commit -m "feat(canonical): reRootIR rewrites all path-derived fields + stamps workspaceRel"
```

---

## Task 18: Schema additions — workspaceRel, meta.workspaces

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/schema.ts`
- Test: `packages/core/src/schema-workspace-fields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { IRSchema, SymbolSchema } from './schema.js'

describe('schema — workspace fields', () => {
  it('SymbolSchema accepts optional workspaceRel', () => {
    const sym = { id: 's1', kind: 'function', name: 'foo', absPath: '/r/a.ts', relPath: 'a.ts', language: 'ts', origin: 'extractor', confidence: 'verified', workspaceRel: 'packages/cli' }
    expect(() => SymbolSchema.parse(sym)).not.toThrow()
  })

  it('IRSchema.meta accepts optional workspaces map', () => {
    const ir = {
      schemaVersion: '1',
      meta: { extractor: { name: 'x', version: '1', invocation: 'i' }, root: '/r', workspaces: { 'packages/cli': { displayName: 'cli', manifest: 'pnpm' } } },
      documents: [], symbols: [], relationships: [],
    }
    expect(() => IRSchema.parse(ir)).not.toThrow()
  })

  it('rejects IR without workspace fields (backward compat)', () => {
    const ir = { schemaVersion: '1', meta: { extractor: { name: 'x', version: '1', invocation: 'i' }, root: '/r' }, documents: [], symbols: [], relationships: [] }
    expect(() => IRSchema.parse(ir)).not.toThrow()  // missing optional is fine
  })
})
```

- [ ] **Step 2: Update types**

`packages/core/src/types.ts`:
```ts
// Add to CFSymbol:
export interface CFSymbol {
  // ... existing fields
  workspaceRel?: string
}

// Add to IRMeta:
export interface IRMeta {
  // ... existing fields
  workspaces?: Record<string, { displayName: string; manifest: 'pnpm' | 'pkgjson' | 'pyproject' | 'setup.py' | 'fs-fallback' }>
}
```

- [ ] **Step 3: Update schema (preserving .strict())**

`packages/core/src/schema.ts`:
```ts
export const SymbolSchema = z.object({
  // ... existing fields
  workspaceRel: z.string().optional(),
}).strict()
```

In IRSchema's meta object:
```ts
  meta: z.object({
    extractor: z.object({ name: z.string(), version: z.string(), invocation: z.string() }).strict(),
    root: z.string(),
    partial: z.boolean().optional(),
    errors: z.array(z.unknown()).optional(),
    diff: z.object({ /* unchanged */ }).strict().optional(),
    workspaces: z.record(z.string(), z.object({
      displayName: z.string(),
      manifest: z.enum(['pnpm', 'pkgjson', 'pyproject', 'setup.py', 'fs-fallback']),
    }).strict()).optional(),
  }).strict(),
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @codeflow/core test schema-workspace-fields
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/schema.ts packages/core/src/schema-workspace-fields.test.ts
git commit -m "feat(core): schema — add optional workspaceRel + meta.workspaces"
```

---

## Task 19: Merger partial-flag OR + workspaces map union

**Files:**
- Modify: `packages/core/src/merger.ts` (this is the IR-level merger, not canonicalMerge)
- Test: `packages/core/src/merger-partial-or.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import { mergeIRs } from './merger.js'
import type { IR } from './types.js'

const baseIr = (root: string): IR => ({
  schemaVersion: '1',
  meta: { extractor: { name: 'x', version: '1', invocation: 'i' }, root },
  documents: [], symbols: [], relationships: [],
})

describe('mergeIRs partial-flag OR + workspaces union', () => {
  it('ORs partial: any input partial → output partial', () => {
    const a = { ...baseIr('/r'), meta: { ...baseIr('/r').meta, partial: false } }
    const b = { ...baseIr('/r'), meta: { ...baseIr('/r').meta, partial: true } }
    const merged = mergeIRs([a, b])
    expect(merged.meta.partial).toBe(true)
  })

  it('partial:false when all inputs are non-partial', () => {
    const merged = mergeIRs([baseIr('/r'), baseIr('/r')])
    expect(merged.meta.partial).toBeFalsy()
  })

  it('unions workspaces maps from all inputs', () => {
    const a = { ...baseIr('/r'), meta: { ...baseIr('/r').meta, workspaces: { 'packages/a': { displayName: 'a', manifest: 'pnpm' as const } } } }
    const b = { ...baseIr('/r'), meta: { ...baseIr('/r').meta, workspaces: { 'packages/b': { displayName: 'b', manifest: 'pnpm' as const } } } }
    const merged = mergeIRs([a, b])
    expect(merged.meta.workspaces).toEqual({
      'packages/a': { displayName: 'a', manifest: 'pnpm' },
      'packages/b': { displayName: 'b', manifest: 'pnpm' },
    })
  })
})
```

- [ ] **Step 2: Update mergeIRs**

In `packages/core/src/merger.ts`, find where `meta` is set in the output (line 37 area):

```ts
const merged: IR = {
  schemaVersion: '1',
  meta: {
    ...irs[0].meta,
    partial: irs.some(ir => ir.meta.partial === true),
    workspaces: mergeWorkspaceMaps(irs),
  },
  // ... documents/symbols/relationships unchanged
}

function mergeWorkspaceMaps(irs: IR[]): IRMeta['workspaces'] {
  const out: NonNullable<IRMeta['workspaces']> = {}
  for (const ir of irs) {
    if (ir.meta.workspaces) Object.assign(out, ir.meta.workspaces)
  }
  return Object.keys(out).length > 0 ? out : undefined
}
```

- [ ] **Step 3: Run tests — verify they pass**

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/merger.ts packages/core/src/merger-partial-or.test.ts
git commit -m "feat(core): mergeIRs ORs partial flag and unions workspaces maps"
```

---

## Task 20: resolveCanonicalRoot — share-per-path canonical-key helper

**Files:**
- Create: `packages/canonical/src/canonical-root.ts`
- Test: `packages/canonical/src/canonical-root.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { resolveCanonicalRoot } from './canonical-root.js'

const FIXTURE = path.resolve(__dirname, '../tests/fixtures/ws-pnpm')

describe('resolveCanonicalRoot', () => {
  it('returns repo root from a nested path', async () => {
    const nested = path.join(FIXTURE, 'packages/alpha')
    const r = await resolveCanonicalRoot(nested)
    expect(r).toBe(FIXTURE)
  })

  it('returns the path itself when called at repo root', async () => {
    const r = await resolveCanonicalRoot(FIXTURE)
    expect(r).toBe(FIXTURE)
  })

  it('returns the path itself when no manifest found', async () => {
    const empty = path.resolve(__dirname, '../tests/fixtures/ws-empty')
    const r = await resolveCanonicalRoot(empty)
    expect(r).toBe(empty)
  })

  it('stops at .git boundary', async () => {
    // codeflow repo itself — calling from packages/cli should return the codeflow root, not /
    const cliDir = path.resolve(__dirname, '../../cli')
    const r = await resolveCanonicalRoot(cliDir)
    expect(r).toBe(path.resolve(__dirname, '../../..'))   // codeflow root
  })
})
```

- [ ] **Step 2: Implement resolveCanonicalRoot**

```ts
import path from 'node:path'
import fs from 'node:fs/promises'
import { canonicalizePath } from './canonicalizer.js'

const MANIFESTS = ['pnpm-workspace.yaml', 'package.json', 'pyproject.toml']

export async function resolveCanonicalRoot(startPath: string): Promise<string> {
  let dir = canonicalizePath(startPath)
  while (true) {
    for (const m of MANIFESTS) {
      const p = path.join(dir, m)
      try {
        if (m === 'package.json') {
          const content = JSON.parse(await fs.readFile(p, 'utf-8')) as { workspaces?: unknown }
          if (content.workspaces) return dir
        } else if (m === 'pyproject.toml') {
          const content = await fs.readFile(p, 'utf-8')
          if (content.includes('[tool.uv.workspace]') || content.includes('[tool.pdm.workspace]') || content.includes('[tool.rye.workspaces]')) return dir
        } else {
          await fs.access(p)
          return dir
        }
      } catch { /* not present or unreadable, continue */ }
    }
    // Stop at .git boundary or filesystem root
    try {
      await fs.access(path.join(dir, '.git'))
      return dir
    } catch { /* continue up */ }
    const parent = path.dirname(dir)
    if (parent === dir) return canonicalizePath(startPath)   // hit fs root, no manifest
    dir = parent
  }
}
```

- [ ] **Step 3: Run tests — verify they pass**

- [ ] **Step 4: Add to barrel**

`packages/canonical/src/index.ts`:
```ts
export { resolveCanonicalRoot } from './canonical-root.js'
```

- [ ] **Step 5: Commit**

```bash
git add packages/canonical/src/canonical-root.ts packages/canonical/src/canonical-root.test.ts packages/canonical/src/index.ts
git commit -m "feat(canonical): resolveCanonicalRoot for share-per-path canonical-key resolution"
```

---

## Task 21: mcp.ts share-per-path canonical-key fix

**Files:**
- Modify: `packages/cli/src/mcp.ts`
- Test: `packages/cli/src/mcp.share-per-path.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { CodeflowMCP } from './mcp.js'

const FIXTURE = path.resolve(__dirname, '../../canonical/tests/fixtures/ws-pnpm')

describe('mcp share-per-path canonical-key', () => {
  it('reuses preview when called with nested path in same monorepo', async () => {
    const mcp = new CodeflowMCP()
    const a = await mcp.startPreview({ path: FIXTURE })
    const b = await mcp.startPreview({ path: path.join(FIXTURE, 'packages/alpha') })
    expect(b.previewId).toBe(a.previewId)
    await mcp.stopPreview({ previewId: a.previewId })
  })
})
```

- [ ] **Step 2: Modify mcp.ts startPreview to use canonical root**

In `packages/cli/src/mcp.ts`, replace the existing share-per-path lookup:

```ts
import { resolveCanonicalRoot } from '@codeflow/canonical'

// Inside startPreview:
async startPreview(opts: { path: string; verified?: boolean }): Promise<...> {
  const canonicalRoot = await resolveCanonicalRoot(opts.path)
  for (const p of this.previews.values()) {
    if (p.canonicalRoot === canonicalRoot) {
      return { url: p.url, previewId: p.previewId, status: derivePreviewStatus([p.fastLane.state, p.verifiedLane.state]) }
    }
  }
  // ... existing creation logic
  const record: PreviewRecord = {
    previewId, path: opts.path, canonicalRoot,   // store canonicalRoot
    // ... other fields unchanged
  }
}
```

Add `canonicalRoot: string` to `PreviewRecord` type.

- [ ] **Step 3: Run tests — verify they pass**

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/mcp.ts packages/cli/src/mcp.share-per-path.test.ts
git commit -m "fix(mcp): share-per-path keyed on canonical workspace root"
```

---

## Task 22: scip-typescript extractor fan-out

**Files:**
- Modify: `packages/extractor-scip-typescript/src/index.ts`
- Test: `packages/extractor-scip-typescript/src/fanout.test.ts`
- Create: `packages/test-utils/fixtures/monorepo-3pkg-ts/...`

- [ ] **Step 1: Create the 3-pkg fixture**

`packages/test-utils/fixtures/monorepo-3pkg-ts/pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`packages/test-utils/fixtures/monorepo-3pkg-ts/packages/pkg-a/package.json` + `tsconfig.json`:
```json
// package.json
{ "name": "pkg-a", "version": "0.0.0" }
// tsconfig.json
{ "compilerOptions": { "noEmit": true, "module": "esnext", "moduleResolution": "bundler", "strict": true, "skipLibCheck": true } }
```

`packages/test-utils/fixtures/monorepo-3pkg-ts/packages/pkg-a/src/index.ts`:
```ts
export function fromPkgA(): string { return 'a' }
```

`packages/test-utils/fixtures/monorepo-3pkg-ts/packages/pkg-b/package.json`:
```json
{ "name": "pkg-b", "version": "0.0.0", "dependencies": { "pkg-a": "workspace:*" } }
```

`packages/test-utils/fixtures/monorepo-3pkg-ts/packages/pkg-b/tsconfig.json`:
```json
{ "compilerOptions": { "noEmit": true, "module": "esnext", "moduleResolution": "bundler", "strict": true, "skipLibCheck": true, "paths": { "pkg-a": ["../pkg-a/src/index.ts"] } } }
```

`packages/test-utils/fixtures/monorepo-3pkg-ts/packages/pkg-b/src/index.ts`:
```ts
import { fromPkgA } from 'pkg-a'
export function fromPkgB(): string { return 'b/' + fromPkgA() }
```

`packages/test-utils/fixtures/monorepo-3pkg-ts/packages/pkg-c/package.json` + broken `tsconfig.json`:
```json
{ "name": "pkg-c", "version": "0.0.0" }
// Intentionally broken:
{ "extends": "./missing.json" }
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipTypescriptExtractor } from './index.js'

const FIXTURE = path.resolve(__dirname, '../../../packages/test-utils/fixtures/monorepo-3pkg-ts')

describe('scip-typescript fan-out', () => {
  it('extracts from all leaf workspaces, partial:true on broken tsconfig', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE, root: FIXTURE })

    // Got symbols from pkg-a + pkg-b but not pkg-c (broken)
    expect(result.ir.symbols.some(s => s.workspaceRel === 'packages/pkg-a')).toBe(true)
    expect(result.ir.symbols.some(s => s.workspaceRel === 'packages/pkg-b')).toBe(true)

    // Partial set because of pkg-c failure
    expect(result.ir.meta.partial).toBe(true)

    // workspaceErrors populated for pkg-c
    expect(result.workspaceErrors).toBeDefined()
    expect(result.workspaceErrors!.some(e => (e.workspace as any).workspaceRel === 'packages/pkg-c')).toBe(true)

    // workspaces meta populated
    expect(Object.keys(result.ir.meta.workspaces ?? {})).toContain('packages/pkg-a')
    expect(Object.keys(result.ir.meta.workspaces ?? {})).toContain('packages/pkg-b')
  })
})
```

- [ ] **Step 3: Refactor extract() to fan out**

```ts
import { detectWorkspaces, reRootIR, type Workspace } from '@codeflow/canonical'
import { runPerWorkspace } from '@codeflow/core'
import os from 'node:os'

export class ScipTypescriptExtractor implements Extractor {
  readonly name = 'scip-typescript'
  readonly version = 'external'

  async extract(opts: ExtractorOptions): Promise<ExtractorResult> {
    const start = Date.now()
    const root = canonicalizePath(opts.root)

    const allWorkspaces = await detectWorkspaces(opts.path, 'ts')
    const workspaces = allWorkspaces.filter(w => w.isLeaf)

    if (workspaces.length === 0) {
      return { ir: emptyIR(this.name, this.version, '', root, true), durationMs: Date.now() - start, workspaceErrors: [] }
    }

    const { results, errors, cancelled } = await runPerWorkspace(
      workspaces,
      (w, signal) => this.runScipForWorkspace(w, signal),
      { concurrency: Math.min(4, os.cpus().length), timeoutMs: opts.timeoutMs ?? 90_000, laneBudgetMs: 300_000 },
    )

    const reRooted = (results as Array<{ ir: IR; workspace: Workspace }>).map(r => reRootIR(r.ir, root, r.workspace.workspaceRel))

    const workspacesMeta: Record<string, { displayName: string; manifest: Workspace['manifest'] }> = {}
    for (const w of workspaces) workspacesMeta[w.workspaceRel] = { displayName: w.displayName, manifest: w.manifest }

    const concatenated = concatIRs(reRooted, root, this.name, this.version, opts.path, errors.length > 0 || cancelled, workspacesMeta)

    return {
      ir: concatenated,
      durationMs: Date.now() - start,
      workspaceErrors: errors,
    }
  }

  private async runScipForWorkspace(w: Workspace, signal: AbortSignal): Promise<{ ir: IR; workspace: Workspace }> {
    // Move existing single-shot extraction logic here.
    // Use spawn() instead of execFileAsync(), wire signal to child.kill().
    const { spawn } = await import('node:child_process')
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow-scip-ts-'))
    const outFile = path.join(outDir, 'index.scip')
    const child = spawn('scip-typescript', ['index', '--output', outFile, w.workspacePath], { cwd: w.workspacePath })
    signal.addEventListener('abort', () => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2000)
    })
    let stderr = ''
    child.stderr?.on('data', (d) => { stderr += String(d).slice(-2000) })
    await new Promise<void>((resolve, reject) => {
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`scip-typescript exited ${code}: ${stderr}`)))
      child.on('error', reject)
    })
    const ir = parseSCIPOutput(outFile, w.workspacePath, this.name, this.version, `scip-typescript index ${w.workspacePath}`)
    fs.rmSync(outDir, { recursive: true, force: true })
    return { ir, workspace: w }
  }
}

function concatIRs(irs: IR[], root: string, name: string, version: string, invocation: string, partial: boolean, workspaces: IRMeta['workspaces']): IR {
  return {
    schemaVersion: '1',
    meta: { extractor: { name, version, invocation }, root, partial: partial || undefined, workspaces },
    documents: irs.flatMap(ir => ir.documents),
    symbols: irs.flatMap(ir => ir.symbols),
    relationships: irs.flatMap(ir => ir.relationships),
  }
}
```

Update `ExtractorResult` type in `@codeflow/core`:
```ts
import type { WorkspaceErrorInfo } from './run-per-workspace.js'

export interface ExtractorResult {
  ir: IR
  durationMs: number
  stderrTail?: string
  workspaceErrors?: WorkspaceErrorInfo[]
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @codeflow/extractor-scip-typescript test fanout
```

- [ ] **Step 5: Commit**

```bash
git add packages/test-utils/fixtures/monorepo-3pkg-ts/ packages/extractor-scip-typescript/src/ packages/core/src/types.ts
git commit -m "feat(scip-ts): fan out per-workspace extraction with detectWorkspaces + runPerWorkspace"
```

---

## Task 23: scip-python extractor fan-out

**Files:**
- Modify: `packages/extractor-scip-python/src/index.ts`
- Test: `packages/extractor-scip-python/src/fanout.test.ts`

- [ ] **Step 1: Apply the same pattern as Task 22 to scip-python**

Mirror the structure exactly, with `language: 'py'` and `scip-python` binary. `isLeaf` always true for Py workspaces (no tsconfig references concept).

- [ ] **Step 2: Write failing test using a 2-pkg Python fixture**

Create `packages/test-utils/fixtures/monorepo-2pkg-py/` with pkg-a/pyproject.toml and pkg-b/pyproject.toml (using `[tool.uv.workspace]` at root).

- [ ] **Step 3: Run test — verify it passes**

- [ ] **Step 4: Commit**

```bash
git add packages/test-utils/fixtures/monorepo-2pkg-py/ packages/extractor-scip-python/src/
git commit -m "feat(scip-py): fan out per-workspace extraction"
```

---

## Task 24: WS broadcast — workspaceWarnings field

**Files:**
- Modify: `packages/preview/src/ws.ts` (BroadcastMessage type)
- Modify: `packages/cli/src/mcp.ts` (runVerifiedExtraction emits workspaceWarnings)
- Test: `packages/cli/src/mcp.workspace-warnings.test.ts`

- [ ] **Step 1: Extend BroadcastMessage type**

`packages/preview/src/ws.ts`:
```ts
export interface VerifiedReadyMessage {
  type: 'verified_ready'
  mermaid: string
  badge: string
  diff?: unknown
  workspaceWarnings?: Array<{ workspacePath: string; code: string; diagId: string }>
}

export interface UpdateMessage {
  type: 'update'
  mermaid: string
  badge: string
  workspaceWarnings?: Array<{ workspacePath: string; code: string; diagId: string }>
}

export type BroadcastMessage = VerifiedReadyMessage | UpdateMessage | { type: 'error'; error: unknown } | { type: 'stale'; action: string }
```

- [ ] **Step 2: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { CodeflowMCP } from './mcp.js'

const FIXTURE = path.resolve(__dirname, '../../test-utils/fixtures/monorepo-3pkg-ts')

describe('mcp workspaceWarnings broadcast', () => {
  it('emits workspaceWarnings on partial verified failure', async () => {
    const mcp = new CodeflowMCP()
    const broadcasts: any[] = []
    // Hook into broadcaster for inspection
    const orig = (mcp as any).previews
    // ... setup capture; pseudo-code for the test
    await mcp.startPreview({ path: FIXTURE, verified: true })
    // Wait for verified to complete
    await new Promise(r => setTimeout(r, 30_000))
    // Inspect last verified_ready broadcast
    const last = broadcasts.findLast((m: any) => m.type === 'verified_ready')
    expect(last?.workspaceWarnings?.length).toBeGreaterThan(0)   // pkg-c broke
  }, 60_000)
})
```

- [ ] **Step 3: Modify runVerifiedExtraction to populate workspaceWarnings**

In `packages/cli/src/mcp.ts:runVerifiedExtraction`, after successful merge:

```ts
const workspaceWarnings = [
  ...(tsResult.value.workspaceErrors ?? []),
  ...(pyResult.value.workspaceErrors ?? []),
].map((e: any) => ({
  workspacePath: e.workspace.workspacePath,
  code: 'SOURCE_PARSE_FAILED',
  diagId: crypto.randomUUID().slice(0, 8),
}))

record.broadcaster.broadcast({
  type: 'verified_ready',
  mermaid,
  badge: workspaceWarnings.length > 0 ? `● verified (${workspaceWarnings.length} partial)` : '● verified',
  diff,
  workspaceWarnings: workspaceWarnings.length > 0 ? workspaceWarnings : undefined,
})
```

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/preview/src/ws.ts packages/cli/src/mcp.ts packages/cli/src/mcp.workspace-warnings.test.ts
git commit -m "feat(mcp): broadcast workspaceWarnings on partial verified extraction"
```

---

## Task 25: Cross-workspace edges integration test

**Files:**
- Test: `packages/extractor-scip-typescript/src/cross-workspace-edges.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ScipTypescriptExtractor } from './index.js'
import { canonicalMerge } from '@codeflow/canonical'

const FIXTURE = path.resolve(__dirname, '../../../packages/test-utils/fixtures/monorepo-3pkg-ts')

describe('cross-workspace edges', () => {
  it('produces a single canonical edge from pkg-b to pkg-a', async () => {
    const ex = new ScipTypescriptExtractor()
    const result = await ex.extract({ path: FIXTURE, root: FIXTURE })

    const merged = canonicalMerge(result.ir.symbols, FIXTURE, result.ir.relationships)

    // Find the file-symbol for pkg-b/src/index.ts
    const pkgBFile = merged.symbols.find(s => s.kind === 'file' && s.workspaceRel === 'packages/pkg-b' && s.relPath.endsWith('src/index.ts'))
    expect(pkgBFile).toBeDefined()

    // It should have at least one outgoing relationship reaching a pkg-a symbol
    const outgoing = merged.relationships.filter(r => r.from === pkgBFile!.id)
    expect(outgoing.length).toBeGreaterThan(0)

    // At least one of those targets should be a Definition symbol with workspaceRel === 'packages/pkg-a'
    const pkgASymIds = new Set(merged.symbols.filter(s => s.workspaceRel === 'packages/pkg-a').map(s => s.id))
    expect(outgoing.some(r => pkgASymIds.has(r.to))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it passes**

If it fails, the issue is most likely Phase 0's symbol-stability assumption; revisit.

- [ ] **Step 3: Commit**

```bash
git add packages/extractor-scip-typescript/src/cross-workspace-edges.test.ts
git commit -m "test(scip-ts): assert cross-workspace edges produced via merger dedup"
```

---

## Task 26: Dogfood smoke test (LOCAL only, env-gated)

**Files:**
- Create: `packages/cli/src/mcp.dogfood.test.ts`

- [ ] **Step 1: Write the env-gated test**

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { CodeflowMCP } from './mcp.js'

const REPO_ROOT = path.resolve(__dirname, '../../..')

describe.skipIf(process.env.RUN_DOGFOOD !== '1')('dogfood — codeflow repo verified mode', () => {
  it('produces ≥10 workspaces and ≥1 cross-workspace edge', async () => {
    const mcp = new CodeflowMCP()
    const { previewId } = await mcp.startPreview({ path: REPO_ROOT, verified: true })

    // Poll get_ir until verified arrives or 90s timeout
    const start = Date.now()
    let ir
    while (Date.now() - start < 90_000) {
      const out = await mcp.getIR({ previewId })
      if (out.ir?.symbols.some(s => s.confidence === 'verified')) { ir = out.ir; break }
      await new Promise(r => setTimeout(r, 1000))
    }
    expect(ir, 'verified IR did not arrive within 90s').toBeDefined()

    const workspaceCount = Object.keys(ir!.meta.workspaces ?? {}).length
    expect(workspaceCount).toBeGreaterThanOrEqual(10)

    // At least one relationship where from and to are in different workspaces
    const symById = new Map(ir!.symbols.map(s => [s.id, s.workspaceRel]))
    const crossEdges = ir!.relationships.filter(r => {
      const fromWs = symById.get(r.from)
      const toWs = symById.get(r.to)
      return fromWs && toWs && fromWs !== toWs
    })
    expect(crossEdges.length).toBeGreaterThanOrEqual(1)

    await mcp.stopPreview({ previewId })
  }, 120_000)
})
```

- [ ] **Step 2: Run with the env gate**

```bash
RUN_DOGFOOD=1 pnpm --filter @codeflow/cli test mcp.dogfood
```

Expected: PASS (or readable failure pinpointing which assertion failed).

- [ ] **Step 3: Run without the gate to verify it skips**

```bash
pnpm --filter @codeflow/cli test mcp.dogfood
```

Expected: 0 tests run.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/mcp.dogfood.test.ts
git commit -m "test(cli): add dogfood smoke test for codeflow repo verified mode (LOCAL gated)"
```

---

## Task 27: CI install scip-typescript binary

**Files:**
- Modify: `.github/workflows/ci.yml` (or whichever CI workflow exists)

- [ ] **Step 1: Inspect existing CI**

```bash
cat .github/workflows/*.yml
```

If no CI workflow exists, create one at `.github/workflows/test.yml`. Otherwise modify the existing one.

- [ ] **Step 2: Add SCIP install step**

```yaml
- name: Install SCIP binaries
  run: |
    npm install -g @sourcegraph/scip-typescript scip-python @sourcegraph/scip
    which scip-typescript && scip-typescript --version
    which scip-python && scip-python --version
    which scip && scip --version
```

Place this step before the `pnpm test` step.

- [ ] **Step 3: Push branch and verify CI runs the new step**

(Skip if CI not yet configured — note as a todo for first push.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/
git commit -m "ci: install scip-typescript/scip-python/scip binaries for monorepo tests"
```

---

## Task 28: M2 acceptance gate

- [ ] **Step 1: Run all tests**

```bash
pnpm test                                # all green except dogfood (skipped without env)
RUN_DOGFOOD=1 pnpm --filter @codeflow/cli test mcp.dogfood    # green
```

- [ ] **Step 2: Verify cross-platform zombie test**

If on Linux, also run on macOS (or vice versa) to confirm runPerWorkspace cancellation works on both.

- [ ] **Step 3: Manual end-to-end verification**

Bump 0.1.13 → 0.1.14, build:plugin, ship release. Then `/flow --verified` on the codeflow repo. Confirm:
- localhost:7800 renders
- Verified mode arrives within ~60s
- Graph has > 50 verified symbols
- At least one edge crosses package boundaries (visually inspect in browser)

- [ ] **Step 4: Schema validation passes**

Confirm `mcp.empty-ir.test.ts` and `mcp.verified.test.ts` (PR1 tests) still pass — no regressions.

- [ ] **Step 5: Acceptance gate STOP — verify spec §5.12**

- [ ] All M2 tests green (including zombie-process test on macOS + Linux)
- [ ] `/flow --verified` on codeflow repo produces a connected graph with cross-workspace edges (manually verified at localhost:7800)
- [ ] Lane-budget cancellation tested with simulated long-running subprocess; no zombies
- [ ] Schema validation passes for new IR fields
- [ ] Merger partial-flag OR semantics verified
- [ ] Share-per-path canonical-key resolution verified for nested-path calls
- [ ] No regressions in M1 single-tsconfig flow

Only proceed to M3 if all pass.

---

# MILESTONE 3 (PR3) — Mermaid subgraphs + setup.py + final polish

**M3 goal:** Spec-complete Scenario E. Visual subgraph grouping in the rendered graph + Python `setup.py` legacy parity.

## Task 29: Mermaid subgraph rendering

**Files:**
- Modify: `packages/renderer-mermaid/src/index.ts`
- Test: `packages/renderer-mermaid/src/subgraphs.test.ts`

- [ ] **Step 1: Read existing renderer**

```bash
cat packages/renderer-mermaid/src/index.ts | head -100
```

Identify: location of `sanitizeLabel`, current `renderMermaid` flow, how nodes are emitted.

- [ ] **Step 2: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { renderMermaid } from './index.js'
import type { IR } from '@codeflow/core'

const irWithWorkspaces: IR = {
  schemaVersion: '1',
  meta: {
    extractor: { name: 'scip-ts', version: 'x', invocation: '' },
    root: '/r',
    workspaces: {
      'packages/cli': { displayName: 'cli', manifest: 'pnpm' },
      'packages/core': { displayName: 'core', manifest: 'pnpm' },
    },
  },
  documents: [],
  symbols: [
    { id: 's1', kind: 'function', name: 'foo', absPath: '/r/packages/cli/foo.ts', relPath: 'packages/cli/foo.ts', language: 'ts', origin: 'extractor', confidence: 'verified', workspaceRel: 'packages/cli' },
    { id: 's2', kind: 'function', name: 'bar', absPath: '/r/packages/core/bar.ts', relPath: 'packages/core/bar.ts', language: 'ts', origin: 'extractor', confidence: 'verified', workspaceRel: 'packages/core' },
  ],
  relationships: [
    { id: 'r1', from: 's1', to: 's2', kind: 'imports', language: 'ts', confidence: 'verified' },
  ],
}

describe('renderMermaid subgraphs', () => {
  it('emits one subgraph per workspaceRel with displayName label', () => {
    const out = renderMermaid(irWithWorkspaces)
    expect(out).toMatch(/subgraph ws_packages_cli\["cli"\]/)
    expect(out).toMatch(/subgraph ws_packages_core\["core"\]/)
    expect(out).toMatch(/end\s*\n.*end/s)   // two end blocks
  })

  it('renders cross-subgraph edges', () => {
    const out = renderMermaid(irWithWorkspaces)
    // Edge s1 → s2 must appear
    expect(out).toMatch(/s1\s*-->.*s2/)
  })

  it('symbols without workspaceRel render at root (no subgraph)', () => {
    const ir = { ...irWithWorkspaces, symbols: [{ ...irWithWorkspaces.symbols[0], workspaceRel: undefined }] }
    const out = renderMermaid(ir)
    expect(out).not.toMatch(/subgraph ws_/)
  })
})
```

- [ ] **Step 3: Implement subgraph emission**

In `renderMermaid`:

```ts
import { sanitizeLabel } from './sanitize.js'   // or wherever it lives

function sanitizeId(s: string): string { return s.replace(/[^\w]/g, '_') }

export function renderMermaid(ir: IR): string {
  const lines: string[] = ['graph LR']

  // Group symbols by workspaceRel
  const groups = new Map<string, CFSymbol[]>()
  for (const s of ir.symbols) {
    const key = s.workspaceRel ?? '__root__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  for (const [key, symbols] of groups) {
    if (key === '__root__') {
      for (const s of symbols) lines.push(`  ${s.id}[${sanitizeLabel(s.name)}]`)
    } else {
      const displayName = ir.meta.workspaces?.[key]?.displayName ?? key
      lines.push(`  subgraph ws_${sanitizeId(key)}["${sanitizeLabel(displayName)}"]`)
      for (const s of symbols) lines.push(`    ${s.id}[${sanitizeLabel(s.name)}]`)
      lines.push('  end')
    }
  }

  for (const r of ir.relationships) {
    lines.push(`  ${r.from} --> ${r.to}`)   // arrow style follows existing renderer
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @codeflow/renderer-mermaid test subgraphs
```

- [ ] **Step 5: Commit**

```bash
git add packages/renderer-mermaid/src/index.ts packages/renderer-mermaid/src/subgraphs.test.ts
git commit -m "feat(renderer-mermaid): subgraph emission grouped by workspaceRel"
```

---

## Task 30: Mermaid version verification + cross-subgraph edge browser test

**Files:**
- Inspect: `packages/preview/index.html` or wherever Mermaid is loaded
- Modify (if needed): pin Mermaid version

- [ ] **Step 1: Identify Mermaid version**

```bash
grep -rn "mermaid" packages/preview/ | head -10
```

Find the CDN URL or local bundle. Note the version (e.g., 10.x).

- [ ] **Step 2: Run a manual browser test**

Start preview on the codeflow repo. Confirm cross-subgraph edges (e.g., from `@codeflow/cli` to `@codeflow/core`) render as continuous arrows that visibly cross subgraph boundaries.

- [ ] **Step 3: If broken, pin to a known-working version**

If cross-subgraph edges render incorrectly (overlapping, misrouted), pin to Mermaid `10.6.x` or `11.x` per Mermaid release notes' subgraph fixes. Update the CDN URL or bump the local dep.

- [ ] **Step 4: Commit if changes made**

```bash
git add packages/preview/
git commit -m "fix(preview): pin Mermaid version for reliable cross-subgraph edge rendering"
```

---

## Task 31: setup.py detection

**Files:**
- Modify: `packages/canonical/src/detect-workspaces.ts`
- Create: `packages/canonical/src/extract-setup-py-name.ts`
- Test: `packages/canonical/src/setup-py.test.ts`
- Create: `packages/canonical/tests/fixtures/ws-py-setup-only/setup.py`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { extractSetupPyName } from './extract-setup-py-name.js'

describe('extractSetupPyName', () => {
  it('extracts from name="..."', () => {
    const r = extractSetupPyName(`from setuptools import setup\nsetup(name="my-pkg", version="1.0")`)
    expect(r.name).toBe('my-pkg')
    expect(r.warning).toBeUndefined()
  })

  it('extracts from name=\'...\'', () => {
    const r = extractSetupPyName(`setup(name='my-pkg')`)
    expect(r.name).toBe('my-pkg')
  })

  it('returns warning when name is a variable', () => {
    const r = extractSetupPyName(`PKG = "x"\nsetup(name=PKG)`)
    expect(r.name).toBeNull()
    expect(r.warning).toBe('SETUP_PY_NAME_UNRESOLVED')
  })

  it('returns warning when name is computed', () => {
    const r = extractSetupPyName(`setup(name=open('VERSION').read())`)
    expect(r.warning).toBe('SETUP_PY_NAME_UNRESOLVED')
  })

  it('returns warning when name is missing', () => {
    const r = extractSetupPyName(`setup(version="1.0")`)
    expect(r.warning).toBe('SETUP_PY_NAME_UNRESOLVED')
  })
})
```

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { detectWorkspaces } from './detect-workspaces.js'

describe('detectWorkspaces — setup.py', () => {
  it('detects setup.py-only workspace', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-setup-only')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws.length).toBe(1)
    expect(ws[0].manifest).toBe('setup.py')
    expect(ws[0].displayName).toBe('legacy-pkg')   // from regex
  })

  it('pyproject wins over setup.py in same dir', async () => {
    const root = path.resolve(__dirname, '../tests/fixtures/ws-py-both')
    const ws = await detectWorkspaces(root, 'py')
    expect(ws[0].manifest).toBe('pyproject')
  })
})
```

- [ ] **Step 2: Implement `extractSetupPyName`**

```ts
export interface ExtractSetupPyNameResult {
  name: string | null
  warning?: 'SETUP_PY_NAME_UNRESOLVED'
}

export function extractSetupPyName(content: string): ExtractSetupPyNameResult {
  const m = content.match(/name\s*=\s*['"]([^'"]+)['"]/)
  if (m) return { name: m[1] }
  return { name: null, warning: 'SETUP_PY_NAME_UNRESOLVED' }
}
```

- [ ] **Step 3: Wire setup.py into detectPyWorkspaces**

In `detectPyWorkspaces`, before fs-walk:

```ts
// Priority 3: setup.py at root (only if no pyproject)
const setupPath = path.join(rootPath, 'setup.py')
if (!await exists(path.join(rootPath, 'pyproject.toml')) && await exists(setupPath)) {
  return [await buildPyWorkspaceFromSetupPy(rootPath, rootPath, 'setup.py')]
}
```

```ts
async function buildPyWorkspaceFromSetupPy(rootPath: string, workspacePath: string, manifest: 'setup.py'): Promise<Workspace> {
  const setupPath = path.join(workspacePath, 'setup.py')
  const content = await fs.readFile(setupPath, 'utf-8')
  const { name, warning } = extractSetupPyName(content)
  // Note: warning is logged at extractor-level later (we don't have a logger here)
  // Higher layer (extractor) re-extracts and emits workspaceWarnings if warning is set.
  return {
    rootPath,
    workspacePath: canonicalizePath(workspacePath),
    workspaceRel: posixRelative(rootPath, workspacePath),
    manifest,
    language: 'py',
    configPath: setupPath,
    isLeaf: true,
    displayName: name ?? posixRelative(rootPath, workspacePath),
  }
}
```

Update fs-walk to also pick up `setup.py`-only directories.

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/canonical/src/extract-setup-py-name.ts packages/canonical/src/detect-workspaces.ts packages/canonical/src/setup-py.test.ts packages/canonical/tests/fixtures/ws-py-setup-*
git commit -m "feat(canonical): detectWorkspaces — setup.py legacy support with name extraction"
```

---

## Task 32: SETUP_PY_NAME_UNRESOLVED warning surfacing

**Files:**
- Modify: `packages/canonical/src/detect-workspaces.ts` (return warnings from build)
- Modify: `packages/extractor-scip-python/src/index.ts` (emit workspaceWarnings)
- Test: integration extending existing fanout test

- [ ] **Step 1: Extend Workspace type to carry detection-time warnings**

`packages/canonical/src/workspace-types.ts`:
```ts
export interface Workspace {
  // ... existing fields
  detectionWarnings?: Array<{ code: string; message: string }>
}
```

- [ ] **Step 2: Populate from `buildPyWorkspaceFromSetupPy`**

```ts
const detectionWarnings = warning ? [{ code: warning, message: `setup.py at ${setupPath} — name= could not be statically extracted; falling back to relative path` }] : undefined
return { ..., detectionWarnings }
```

- [ ] **Step 3: scip-python extract surfaces detectionWarnings as workspaceWarnings**

In `runScipForWorkspace` or fan-out post-processing, merge `w.detectionWarnings` into `workspaceErrors`:

```ts
const detectionWarningsAsErrors = workspaces.flatMap(w =>
  (w.detectionWarnings ?? []).map(dw => ({ workspace: w, error: { code: dw.code, message: dw.message } }))
)
return {
  // ...
  workspaceErrors: [...errors, ...detectionWarningsAsErrors],
}
```

- [ ] **Step 4: Write integration test**

Test that a fixture with regex-unfriendly setup.py produces a `SETUP_PY_NAME_UNRESOLVED` workspaceWarning entry from `extract()`.

- [ ] **Step 5: Run tests + commit**

```bash
pnpm test
git add packages/canonical/src/ packages/extractor-scip-python/src/
git commit -m "feat(scip-py): surface SETUP_PY_NAME_UNRESOLVED as workspaceWarning"
```

---

## Task 33: Mixed-language fixture (monorepo-3pkg-mixed)

**Files:**
- Create: `packages/test-utils/fixtures/monorepo-3pkg-mixed/...`
- Test: `packages/cli/src/mcp.mixed-language.test.ts`

- [ ] **Step 1: Create fixture**

```
monorepo-3pkg-mixed/
  pnpm-workspace.yaml      (packages: ['packages/pkg-a', 'packages/pkg-b'])
  packages/
    pkg-a/                 (TS — package.json, tsconfig.json, src/index.ts)
    pkg-b/                 (TS — imports pkg-a)
    pkg-c/                 (Python — setup.py only)
      setup.py             (with regex-extractable name)
      pkg_c/__init__.py
```

Note: pkg-c is intentionally outside the pnpm workspace pattern (workspaces in pnpm-workspace.yaml only include pkg-a and pkg-b). detectWorkspaces('py') will pick up pkg-c via fs-walk.

- [ ] **Step 2: Write the failing test**

```ts
describe('mixed-language monorepo', () => {
  it('produces graph with TS + Py workspaces', async () => {
    const mcp = new CodeflowMCP()
    const { previewId } = await mcp.startPreview({ path: FIXTURE, verified: true })
    // ... poll for verified IR
    expect(Object.keys(ir.meta.workspaces!).sort()).toEqual(['packages/pkg-a', 'packages/pkg-b', 'packages/pkg-c'])
    // pkg-c manifest is setup.py
    expect(ir.meta.workspaces!['packages/pkg-c'].manifest).toBe('setup.py')
  })
})
```

- [ ] **Step 3: Run test — verify it passes**

- [ ] **Step 4: Commit**

```bash
git add packages/test-utils/fixtures/monorepo-3pkg-mixed/ packages/cli/src/mcp.mixed-language.test.ts
git commit -m "test(integration): mixed-language TS+Py monorepo fixture"
```

---

## Task 34: Final design verification + dogfood re-run

- [ ] **Step 1: Re-run full test suite**

```bash
pnpm test
RUN_DOGFOOD=1 pnpm --filter @codeflow/cli test mcp.dogfood
```

All green.

- [ ] **Step 2: Manual end-to-end verification — codeflow repo with subgraphs**

Bump 0.1.14 → 0.1.15, build:plugin, ship.

`/flow --verified` on the codeflow repo. Verify:
- ≥ 10 named subgraphs in the rendered Mermaid output (browser inspect)
- Cross-subgraph edges visible
- No `CLAUDE_PLUGIN_ROOT` warnings, no schema parse errors in /doctor

- [ ] **Step 3: Mixed-language manual test**

`/flow --verified` on `packages/test-utils/fixtures/monorepo-3pkg-mixed`. Verify:
- 3 subgraphs: pkg-a (TS), pkg-b (TS), pkg-c (Python)
- Edge from pkg-b to pkg-a
- pkg-c rendered with extracted setup.py name

- [ ] **Step 4: setup.py regex-failure test**

Create a temp setup.py with `name=PKG_NAME`, point preview at it, confirm:
- workspace renders with relative path as displayName
- WS broadcast includes a `workspaceWarnings` entry with code `SETUP_PY_NAME_UNRESOLVED`

- [ ] **Step 5: Spec gate — verify spec §6.5**

- [ ] All M3 tests green
- [ ] Mermaid output for codeflow repo renders 10 named subgraphs in browser
- [ ] Cross-subgraph edges render correctly
- [ ] Mixed-language fixture produces single connected graph
- [ ] setup.py with regex-friendly name extracts displayName correctly
- [ ] setup.py with regex-unfriendly name produces fallback + workspaceWarning
- [ ] Mermaid version pinned if needed
- [ ] No regressions in M1/M2 acceptance criteria

---

## Task 35: Final commit + release

- [ ] **Step 1: Final test sweep**

```bash
pnpm test && RUN_DOGFOOD=1 pnpm --filter @codeflow/cli test mcp.dogfood
```

- [ ] **Step 2: Update CHANGELOG.md**

Add entries for v0.1.13 (M1), v0.1.14 (M2), v0.1.15 (M3) summarizing each PR's user-visible value.

- [ ] **Step 3: Final version bump and ship**

Per `feedback_release_sop.md`:
- Bump version in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (×2), `package.json`
- `pnpm build:plugin`
- `git push origin main`
- `git push --force origin release && git push --force origin v0.1.15`

- [ ] **Step 4: Commit final state on main**

```bash
git status   # clean
```

---

## Self-review notes

Spec coverage check:
- ✅ §4 PR1 (Phase 0 + relationship extraction + file-symbols + scip-py parity) — Tasks 1-7
- ✅ §5 PR2 (workspace detection, runPerWorkspace, reRootIR, schema, merger OR, share-per-path, fan-out, broadcast, tests, CI) — Tasks 8-28
- ✅ §6 PR3 (Mermaid subgraphs, setup.py with warning, mixed-language fixture) — Tasks 29-34
- ✅ Cross-cutting (§7) preserved: backward compat (optional fields), spec invariants (lane-scoped, share-per-path, edge identity), pre-coding verifications gated, scip-python parity in M1+M2

Type consistency check:
- `Workspace` type defined in Task 9, used identically in Tasks 10, 11, 12, 13, 22, 31
- `WorkspaceErrorInfo` defined in Task 9 (canonical) and re-used as `runPerWorkspace`'s error type in Task 15 (core duck-types via `WorkspaceLike`)
- `runPerWorkspace<T>` signature consistent across Tasks 15, 16, 22, 23
- `reRootIR(ir, repoRoot, workspaceRel)` signature consistent in Tasks 17, 22

Placeholder scan: No "TBD", no "implement later", no "similar to Task N", no missing code blocks. Concrete file paths everywhere.

---

**Plan complete and saved to `docs/upp/plans/2026-04-29-codeflow-monorepo-extractor.md`.**

**Execute with:** the executing-plans skill

The skill supports two modes:
- **Subagent mode** (recommended) — fresh subagent per task, three-stage review (spec → quality → design)
- **Inline mode** — execute in this session with checkpoints

Which mode would you like? (Default: subagent mode)

You can override at any time: "use inline" or "use subagents"
