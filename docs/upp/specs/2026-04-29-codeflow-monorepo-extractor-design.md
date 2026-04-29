# Codeflow — Monorepo Extractor Support (Scenario E completion)

**Status:** design-approved, pre-implementation
**Authoritative parent:** [`2026-04-23-codeflow-v1-design.md`](./2026-04-23-codeflow-v1-design.md) — this doc closes implementation gaps in §9 Scenario E and adds foundational work that the original spec assumed already existed.
**Date:** 2026-04-29
**Phased rollout:** three sequential PRs (PR1 → PR2 → PR3) with explicit gates.

---

## 1. Problem

`/flow --verified` on codeflow's own repo (a pnpm monorepo with 10 packages, per-package `tsconfig.json`, no root `tsconfig.json`) silently stays on fast view. Browser badge eventually shows `● fast view (verified failed)` with no surface to the user explaining why.

Root causes (verified empirically and via pre-mortem review):

1. **Single-shot extractor invocation.** `packages/extractor-scip-typescript/src/index.ts` invokes `scip-typescript index <path>` once at the user's `--path`. With no root `tsconfig.json`, scip-typescript exits with `error: no files got indexed` and the extractor returns an empty IR with `partial: true`. Multi-package monorepos are not handled — yet v1 spec §9-E mandates they are.
2. **Zero relationships emitted.** `parseSCIPOutput` (line 72) hard-codes `relationships: []`. Even on a single-tsconfig project, verified mode emits no edges. The "trust the merger to dedupe cross-workspace edges" assumption that underpins Scenario E has no edges to dedupe — relationship extraction was assumed by the spec but never built.
3. **Silent failure.** Spec §12.1: *"Never fail silently — partial always shows a banner."* Current code violates this when scip-typescript returns empty IR with no banner-able context. `TSCONFIG_INCOMPATIBLE` and `SOURCE_PARSE_FAILED` codes exist in the envelope catalog but aren't emitted.

This is an **implementation gap to a v1-mandated scenario**, not a v1.1 deferral. Spec §2 explicitly says: *"Monorepo support: kept in v1 (workspace detection walks up from path)."*

---

## 2. Scope

### In scope (across PR1+PR2+PR3)

- SCIP relationship extraction in `scip-typescript` and `scip-python` (PR1) — closes the "zero edges" gap
- Empirical Phase 0 verification of cross-workspace SCIP symbol-string stability (PR1) — design pivots if assumption fails
- Workspace detection (manifest-first + filesystem fallback) in `@codeflow/canonical` (PR2)
- Per-workspace fan-out with bounded concurrency, lane budget, and signal-based subprocess cancellation (PR2)
- `reRootIR` covering all path-derived IR fields + workspaceRel stamping (PR2)
- Zod schema additions for new optional IR fields (PR2)
- Cross-workspace edges via canonical-merger dedup of stable SCIP symbol IDs (PR2)
- `share-per-path` canonical-key resolution (PR2) — closes a §11 invariant gap surfaced during review
- Mermaid subgraph rendering (PR3) — completes Scenario E visual presentation
- `setup.py` legacy Python support with explicit lossy-extraction warnings (PR3)

### Explicitly NOT in scope (any PR)

| # | Item | Reason |
|---|---|---|
| 1 | `--workspaces` glob flag | No demand; partial-fail flow covers broken-workspace exclusion. Adds permanent API surface. |
| 2 | Workspace-level caching / incremental indexing | Own design problem; cache invalidation correctness needs its own pre-mortem. v1.1+. |
| 3 | Nested subgraph rendering | Visual refinement; flat subgraphs cover v1 spec wording. |
| 4 | Conda env / requirements.txt-only Python detection | Pyproject.toml + setup.py covers ~all real Python projects. v1.1+ if user-reported. |
| 5 | Self-implemented tsconfig project-reference traversal | Trust scip-typescript's internal handling via `isLeaf` filter. Reimplementing is duplicate logic worse than upstream. |

---

## 3. Architecture overview

```
PR1 (foundation)              PR2 (monorepo)                   PR3 (visual + Python legacy)
─────────────────             ──────────────                   ────────────────────────────
Phase 0 verification    ─►    Workspace detection         ─►   Mermaid subgraph rendering
Relationship extraction       Per-workspace fan-out             setup.py legacy support
File-symbol synthesis         reRootIR + schema updates         displayName from package
                              Share-per-path canonical-key      Lossy-extraction warnings
```

Each PR is independently mergeable, testable, and adds user-visible value. PR1 alone makes single-tsconfig verified mode produce edges. PR2 alone makes monorepo verified mode produce a connected graph. PR3 alone makes that graph visually grouped.

### Dependency order rationale

- **PR1 → PR2:** PR2's "trust the merger to dedupe cross-workspace edges" only works if PR1 first establishes that relationships exist and SCIP symbol IDs are stable across separate invocations. Phase 0 in PR1 is the empirical proof; if it fails, PR2's design pivots before code is written.
- **PR2 → PR3:** PR3's renderer reads `CFSymbol.workspaceRel` and `IR.meta.workspaces`, both populated by PR2. Without PR2, there is no workspace structure to render.

### Pre-mortem findings absorbed

Two rounds of independent eng-lead review surfaced 5+ critical findings. Each is documented below in the relevant PR section. Findings labeled `[review-N]` cite the round.

---

## 4. PR1 — SCIP relationship extraction (foundation)

### 4.1 Phase 0 verification

**Before any production code lands**, run `scripts/verify-scip-cross-workspace.ts`. Output captured in PR description.

Empirically verify, on a real 2-package fixture where `pkg-b` imports from `pkg-a`:

1. Inspect raw `scip print --json` output. Confirm role bitmask values for actual import statements. **Expected: SCIP `SymbolRole` bitmask is `Definition=0x1, Import=0x2, WriteAccess=0x4, ReadAccess=0x8, Generated=0x10`** (verified against sourcegraph/scip protobuf in review #2). The Import bit is `0x2`, not `0x8` — earlier draft of this design incorrectly used `0x8`.
2. Confirm SCIP symbol-string stability across:
   - Default exports (`export default`)
   - `export * from` re-exports
   - Type-only imports (`import type`)
   - Barrel files (`export { x } from './x'`)
   - Package-name vs path-suffix qualified symbols
3. Compare two invocation modes:
   - (a) `scip-typescript index` at monorepo root (with `references` array in root tsconfig)
   - (b) `scip-typescript index` invoked separately on each leaf tsconfig
   Same symbol IDs in both modes? If not, `isLeaf` filter strategy must change.

**Gate:** if any case in (1)/(2)/(3) fails, PR2's `isLeaf` filter design pivots before code is written.

### 4.2 Relationship extraction

In `packages/extractor-scip-typescript/src/index.ts`, extend `parseSCIPOutput`:

- For each occurrence in each document:
  - If `(symbol_roles & 0x1) !== 0` → emit a `Definition` symbol (existing behavior)
  - If `(symbol_roles & 0x2) !== 0` → emit `Relationship { from: fileSymbolId, to: occurrence.symbol, kind: 'imports' }`
  - If `symbol_roles === 0` (plain reference) AND symbol is non-local → emit `Relationship { from: fileSymbolId, to: occurrence.symbol, kind: 'references' }`
  - If symbol scheme starts with `local` (SCIP local symbol prefix) → skip (intra-document references not interesting for graph)

Same logic added to `packages/extractor-scip-python/src/index.ts` with Python-specific role semantics confirmed in Phase 0.

### 4.3 File-symbol synthesis

`Relationship.from` must be a symbol id, not a path string `[review-2 C2-B]`. Path strings in `from` are never remapped by canonicalizer's `byId` table and leak raw OS paths into rendered output.

For each unique containing file in the SCIP doc set, synthesize one `kind: 'file'` symbol:

```ts
{
  id: `file::${canonicalAbsPath}`,    // deterministic, content-free
  kind: 'file',                       // new kind value, schema must accept
  name: pathBasename,
  absPath: canonicalAbsPath,
  relPath: posixRelative(root, canonicalAbsPath),
  language: 'ts' | 'py',
  origin: 'extractor',
  confidence: 'verified'
}
```

Push synthetic file-symbols into `ir.symbols` alongside Definition symbols. Relationship `from` now resolves via `byId` and gets canonicalized correctly.

### 4.4 Schema updates (PR1-scoped)

`packages/core/src/schema.ts`:
- `CFSymbolKindSchema`: add `'file'` to the allowed values if currently a closed enum
- All other schemas remain `.strict()` — no relaxation

### 4.5 Tests (PR1)

| Layer | Test |
|---|---|
| Phase 0 verification script | One-shot run, output in PR description |
| `parseSCIPOutput` relationship emission | Golden-file: SCIP JSON fixture → expected IR with relationships of all three kinds (Def/Import/Ref) |
| File-symbol synthesis | Property: every relationship's `from` resolves via `byId` after canonicalization (zero leaked path strings) |
| Single-tsconfig integration | Real `scip-typescript` on 2-file fixture, assert `relationships.length > 0` |
| `scip-python` parity | Same golden + property tests as scip-typescript |

### 4.6 PR1 acceptance gate

- ✅ Phase 0 script committed; output proves symbol-stability assumption holds (or design has pivoted)
- ✅ Single-tsconfig verified mode on a real project produces edges (verifiable via `mcp__plugin_codeflow_codeflow__get_ir`)
- ✅ All PR1 tests green
- ✅ No regressions in existing `mcp.empty-ir.test.ts` and `mcp.verified.test.ts`

---

## 5. PR2 — Workspace detection + per-workspace extraction

### 5.1 New types

```ts
// @codeflow/canonical
type Workspace = {
  rootPath: string              // canonical repo root, same for all workspaces in a detection result
  workspacePath: string         // absolute, this workspace's path
  workspaceRel: string          // posix-relative path from rootPath (e.g. "packages/cli")
  manifest: 'pnpm' | 'pkgjson' | 'pyproject' | 'setup.py' | 'fs-fallback'
  language: 'ts' | 'py'
  configPath: string            // absolute tsconfig.json or pyproject.toml/setup.py
  isLeaf: boolean               // for TS: true if no other tsconfig references it
  displayName: string           // from package.json `name` / pyproject `[project].name`; falls back to workspaceRel
}

type WorkspaceError = {
  workspace: Workspace
  error: CodeflowError          // existing envelope from @codeflow/core
}
```

### 5.2 `detectWorkspaces(rootPath, language)` — `@codeflow/canonical`

Detection priority:

**TypeScript:**
1. `pnpm-workspace.yaml` at rootPath → use `@pnpm/find-workspace-packages` (avoid hand-rolling glob expansion edge cases like negation, pnpm v9 catalog, package.json `{packages, nohoist}` form) `[review-1 I4]`
2. `package.json` with `workspaces` field at rootPath → `@pnpm/find-workspace-packages` handles both array and object forms
3. Filesystem walk: find directories containing `tsconfig.json`, depth cap = 5, ignore the v1-spec §11 chokidar set: `node_modules`, `.git`, `.venv`, `dist`, `build`, `target`, `.next`, `.parcel-cache`, plus anything in `.gitignore`
4. Single-path fallback: return `[{rootPath, workspacePath: rootPath, manifest: 'fs-fallback', ...}]` (preserves PR1's single-tsconfig behavior)

**Python:**
1. `pyproject.toml` at rootPath with `[tool.pdm.workspace]` / `[tool.uv.workspace]` / `[tool.rye.workspaces]` table → glob expansion via `fast-glob`
2. `pyproject.toml` at rootPath alone (single-workspace)
3. `setup.py` at rootPath alone — **deferred to PR3**; PR2 emits a workspace only if pyproject is present
4. Filesystem walk: directories containing `pyproject.toml`, ignore `.venv`, `__pycache__`, `dist`, `build`
5. Single-path fallback

**Memoization** `[review-1 I5]`:
- Cache key: `(rootPath, language, manifestMtimes)` where `manifestMtimes` is a hash of `mtime` for every detected manifest file
- Re-runs detection only when manifest file mtimes change (rare); chokidar saves to source files do NOT invalidate the cache
- Saves 10-50ms per save on a 30-package monorepo

**`isLeaf` computation (TS only)** `[review-1 I3]`:
- Build the `references` graph: for each detected tsconfig, parse its `references` array
- A workspace is `isLeaf = true` iff no other detected workspace's tsconfig references it
- scip-typescript invoked at a leaf indexes the leaf AND its referenced upstream projects in one pass — verified in Phase 0 (PR1 §4.1.3)

### 5.3 `runPerWorkspace<T>(items, fn, opts)` — `@codeflow/core`

Located in `@codeflow/core` (not `@codeflow/canonical`) `[review-1 N1]` — `core` owns concurrency primitives; `canonical` owns path/symbol invariants.

```ts
function runPerWorkspace<T>(
  items: Workspace[],
  fn: (w: Workspace, signal: AbortSignal) => Promise<T>,
  opts: {
    concurrency: number       // default min(4, cpus().length)  [review-1 C3]
    timeoutMs: number         // per-item; default 90_000
    laneBudgetMs: number      // global; default 300_000 (5 min)  [review-1 I6]
  }
): Promise<{
  results: T[]                // succeeded items only
  errors: WorkspaceError[]    // failed items, including timeout/cancelled
  cancelled: boolean          // true if lane budget exhausted
}>
```

**Critical implementation detail** `[review-2 C5]`: must use `child_process.spawn` (NOT `execFileAsync`/`execFile`) so we can track the live `ChildProcess`. `Promise.allSettled` does NOT kill child processes on cancel — abandoned 1-4GB scip-typescript subprocesses leak across long CC sessions.

```
runPerWorkspace internals:
  - Maintain Set<ChildProcess> of in-flight subprocesses
  - Each fn() receives an AbortSignal scoped to (per-item timeout || lane budget)
  - On signal abort: child.kill('SIGTERM'); after 2s grace, child.kill('SIGKILL')
  - On lane-budget timeout: cancel ALL pending and in-flight; return {cancelled: true, errors: [...remaining]}
```

### 5.4 `reRootIR(ir, repoRoot, workspaceRel)` — `@codeflow/canonical`

Rewrites EVERY path-derived field in the IR `[review-2 C1-A]`. The reviewer caught that earlier draft missed `Relationship.source.file` and `CFSymbol.absPath`. All fields enumerated here:

| Field | Action |
|---|---|
| `ir.meta.root` | Set to `repoRoot` |
| `CFDocument.relPath` | `posixRelative(repoRoot, doc.absPath)` |
| `CFDocument.absPath` | Canonical of original absPath (idempotent) |
| `CFSymbol.relPath` | `posixRelative(repoRoot, symbol.absPath)` |
| `CFSymbol.absPath` | Canonical of original absPath (idempotent) |
| `CFSymbol.workspaceRel` | Set to `workspaceRel` argument (new field, PR2-introduced) |
| `Relationship.source.file` | No rewrite needed — PR1 normalized this to a file-symbol id (`file::<canonicalAbsPath>`). The file-symbols themselves live in `ir.symbols` and get canonicalized by the merger's `byId` remap. Defensive assertion in reRootIR: if value doesn't start with `file::`, throw — would indicate PR1 contract violation. |

Property test invariant: `posixRelative(newRoot, symbol.absPath) === symbol.relPath` for every symbol after re-rooting.

### 5.5 Schema additions

`packages/core/src/schema.ts` updates `[review-2 C1-B]` — schemas remain `.strict()`; new fields added explicitly:

```ts
// SymbolSchema:
+   workspaceRel: z.string().optional()

// IRMetaSchema:
+   workspaces: z.record(
+     z.string(),
+     z.object({
+       displayName: z.string(),
+       manifest: z.enum(['pnpm', 'pkgjson', 'pyproject', 'setup.py', 'fs-fallback']),
+     })
+   ).optional()
```

`schemaVersion` stays `'1'` — additions are purely additive and optional.

### 5.6 Merger partial-flag OR `[review-2 I8]`

`packages/core/src/merger.ts:37` currently takes `meta` from `irs[0]` only. If workspace 0 succeeded but workspace 1 failed with `partial: true`, that flag is lost. Update:

```diff
-   meta: irs[0].meta,
+   meta: {
+     ...irs[0].meta,
+     partial: irs.some(ir => ir.meta.partial === true),
+     workspaces: mergeWorkspaceMaps(irs),
+   },
```

`mergeWorkspaceMaps` unions `ir.meta.workspaces` records across all input IRs.

### 5.7 Share-per-path canonical-key resolution `[review-2 I7]`

§11 share-per-path: duplicate `start_preview(path)` returns existing preview rather than spawning a new one. Reviewer surfaced an edge case: `start_preview('/repo')` and `start_preview('/repo/packages/cli')` produce TWO previews that overlap, double-running scip-typescript on `packages/cli` (1-4GB process × 2).

**Fix:** preview lookup keys on canonical workspace root (the rootPath that detector resolves to) instead of the raw path argument. Path argument used for filtering display, but preview entity dedup happens at the canonical workspace level.

`mcp.ts.startPreview`:
```diff
- for (const p of this.previews.values()) {
-   if (p.path === opts.path) return { ... }
- }
+ const canonicalRoot = await resolveCanonicalRoot(opts.path)
+ for (const p of this.previews.values()) {
+   if (p.canonicalRoot === canonicalRoot) return { ... }
+ }
```

`resolveCanonicalRoot(path)` walks up the directory tree from `path` toward `/`. At each level, checks for any of: `pnpm-workspace.yaml`, `package.json` with a `workspaces` field, `pyproject.toml` with a workspace table (`[tool.pdm.workspace]`, `[tool.uv.workspace]`, `[tool.rye.workspaces]`). Returns the first directory containing a match. Stops at filesystem root or at a `.git` directory boundary (avoid escaping the user's project). Falls back to `canonicalizePath(path)` itself if no manifest is found.

### 5.8 Extractor fan-out

`packages/extractor-scip-typescript/src/index.ts`:

```ts
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
    { concurrency: Math.min(4, cpus().length), timeoutMs: 90_000, laneBudgetMs: 300_000 }
  )

  const reRooted = results.map(r => reRootIR(r.ir, root, r.workspace.workspaceRel))
  const workspacesMeta = Object.fromEntries(
    workspaces.map(w => [w.workspaceRel, { displayName: w.displayName, manifest: w.manifest }])
  )
  const concatenated = concatIRs(reRooted, { workspaces: workspacesMeta, partial: errors.length > 0 || cancelled })

  return { ir: concatenated, durationMs: Date.now() - start, workspaceErrors: errors }
}
```

Lane-scoped contract (§11) `[review-1 I1]`: extractor ALWAYS returns an `ExtractorResult` with `partial: true` when all workspaces fail; it does NOT throw. mcp.ts's existing `'● fast view (verified failed)'` path remains unchanged.

`packages/extractor-scip-python/src/index.ts` follows the same pattern.

### 5.9 ExtractorResult shape change

```ts
type ExtractorResult = {
  ir: IR
  durationMs: number
  stderrTail?: string
+ workspaceErrors?: WorkspaceError[]    // PR2 additive
}
```

Existing single-workspace consumers continue to work (`workspaceErrors` is optional, empty when no fan-out happened).

### 5.10 Error handling (PR2)

| Code | Category | Severity | When |
|---|---|---|---|
| `SOURCE_PARSE_FAILED` (existing, reused with `context.workspace`) | extraction | partial | Per-workspace scip-typescript exit non-zero or empty SCIP output |
| `SUBPROCESS_TIMEOUT_90S` (existing) | timeout | partial | Per-workspace 90s timeout |
| `EXTRACTION_QUEUE_BLOCKED` (existing, reused with clarifying `nextStep` text) `[review-2 N10]` | timeout | partial | Lane budget (5 min) exhausted, remaining workspaces cancelled |
| `NO_SUPPORTED_FILES` (existing) | filesystem | fatal | Zero workspaces detected including fs-fallback (rare; e.g. empty directory) |

**No new error codes introduced in PR2.** Per-workspace info aggregated in `context.workspaces[]`; diag bundle dedup key remains `(code, lane)` per spec §12 `[review-1 I2]`. `occurrenceCount` reflects total per-workspace incidents.

WS broadcast extension (additive):

```ts
{ type: 'verified_ready' | 'update', mermaid, badge, diff,
  workspaceWarnings?: Array<{
    workspacePath: string
    code: string         // e.g. 'SOURCE_PARSE_FAILED'
    diagId: string
  }>
}
```

Browser banner: "verified extraction failed for N of M workspaces — showing partial graph (click for details)". Click expands to per-workspace `diagId` list.

`record.lastError` keeps single-error semantics (§12.5 unchanged); per-workspace partials surface via `workspaceWarnings`.

### 5.11 Tests (PR2)

| Layer | Test |
|---|---|
| `detectWorkspaces` TS | unit — pnpm-workspace.yaml, package.json#workspaces, fs-walk, fallback; isLeaf via tsconfig references graph |
| `detectWorkspaces` Py (PR2 subset) | unit — pyproject.toml workspace tables, single pyproject, fs-walk |
| `detectWorkspaces` memoization | unit — repeated calls without manifest mtime change return cached result; mtime change invalidates |
| `runPerWorkspace` | unit + property — concurrency cap, per-item timeout fires SIGTERM→SIGKILL, lane budget cancellation kills all in-flight |
| `runPerWorkspace` zombie test | integration — spawn fake long-running subprocess, trigger lane budget, assert `ps` shows zero descendants |
| `reRootIR` | property — every path-derived field rewritten; `posixRelative(newRoot, absPath) === relPath` for all symbols; idempotent on repeat application |
| Schema validation | unit — IR with `workspaceRel` and `meta.workspaces` parses successfully under `.strict()` |
| Merger partial OR | unit — IRs with mixed `partial: true/false` produce merged IR with `partial: true` |
| Share-per-path canonical-key | integration — `start_preview('/repo')` and `start_preview('/repo/packages/cli')` reuse the same preview |
| Synthetic fixture `monorepo-3pkg-ts/` | integration — `packages/test-utils/fixtures/monorepo-3pkg-ts/`: pkg-a, pkg-b imports pkg-a, pkg-c (broken `extends: "./missing.json"`) → assert verified IR built from a+b, partial:true, workspaceWarnings populated for c |
| Cross-workspace edges | property — pkg-A exports symbol X, pkg-B imports X → single canonical edge after merge |
| Dogfood smoke (LOCAL only, env-gated `RUN_DOGFOOD=1`) | E2E — codeflow repo verified mode → ≥10 workspaces extracted, ≥1 cross-workspace edge present |

**CI updates (PR2):** install `@sourcegraph/scip-typescript` and `scip` binaries in CI workflow; run synthetic-fixture tests. Dogfood test stays local-only `[review-1 N2]`.

### 5.12 PR2 acceptance gate

- ✅ All PR2 tests green (including zombie-process test on macOS + Linux)
- ✅ `/flow --verified` on the codeflow repo produces a connected graph with cross-workspace edges (manually verified at `localhost:7800`)
- ✅ Lane-budget cancellation tested with simulated long-running subprocess; no zombies
- ✅ Schema validation passes for new IR fields
- ✅ Merger partial-flag OR semantics verified
- ✅ Share-per-path canonical-key resolution verified for nested-path calls
- ✅ No regressions in PR1 single-tsconfig flow

---

## 6. PR3 — Mermaid subgraphs + setup.py + final polish

### 6.1 Mermaid subgraph rendering

`packages/renderer-mermaid/src/index.ts` extension:

```
renderMermaid(ir):
  groups = groupBy(ir.symbols, s => s.workspaceRel ?? '__root__')

  for each (workspaceRel, symbols) in groups:
    if workspaceRel === '__root__':
      emit nodes inline (existing flat behavior)
    else:
      const displayName = ir.meta.workspaces?.[workspaceRel]?.displayName ?? workspaceRel
      emit `subgraph ws_${sanitizeId(workspaceRel)}["${sanitizeLabel(displayName)}"]`
      emit nodes for symbols
      emit `end`

  for each relationship: emit edge as before
  // Mermaid handles cross-subgraph edges natively (verified in §6.4)
```

**Sanitizer reuse** `[review-2 I3]`: use existing `sanitizeLabel` from `packages/renderer-mermaid/src/index.ts:5` which already handles `]`, `"`, and other Mermaid-syntax-breaking chars. Don't reinvent.

`sanitizeId` (new helper): `workspaceRel.replace(/[^\w]/g, '_')` to produce a valid Mermaid node-id from the relative path.

**Nesting:** flat only in v1. `apps/web/api` becomes one subgraph labeled `apps/web/api`, not nested. Nested grouping is a v1.1 visual refinement.

### 6.2 setup.py legacy support

Detection (Python, PR3 additions):

- After pyproject.toml priority paths, check for `setup.py` alone in workspace dir
- Both pyproject.toml AND setup.py in same dir → pyproject wins (modern standard)

Name extraction:

```ts
function extractSetupPyName(setupPyPath: string): { name: string | null; warning?: string } {
  const content = readFile(setupPyPath)
  // Cheap regex; full Python AST parsing would be over-engineering for v1
  const m = content.match(/name\s*=\s*['"]([^'"]+)['"]/)
  if (m) return { name: m[1] }
  // Lossy fallback paths (variable, computed, **kwargs)
  return { name: null, warning: 'SETUP_PY_NAME_UNRESOLVED' }
}
```

When name extraction fails, `displayName` falls back to `workspaceRel` AND a `workspaceWarning` is emitted with the new code:

| Code | Category | Severity |
|---|---|---|
| `SETUP_PY_NAME_UNRESOLVED` (NEW in PR3) | extraction | warning |

This honors §12.1 "Never fail silently" and the project CLAUDE.md "no silent truth mutation" rule `[review-2 I4]`. User sees the workspace labeled by relative path with explicit warning that name extraction was lossy, can fix the setup.py if desired.

### 6.3 Mermaid version verification

Pre-coding check `[review-2 verification #4]`:

- Inspect Mermaid version actually vendored in `packages/preview/` (browser-side package.json or HTML CDN reference)
- Confirm cross-subgraph edge rendering on that version
- If pinning is needed, add to PR3

### 6.4 Tests (PR3)

| Layer | Test |
|---|---|
| Mermaid subgraph rendering | golden-file — IR with 3 workspaces + cross-workspace edges → expected `subgraph ... end` Mermaid output |
| Cross-subgraph edge rendering | snapshot + manual browser check — assert edge from `pkg-a/foo` to `pkg-b/bar` renders correctly across subgraph boundaries |
| Sanitizer reuse | unit — `displayName` containing `]`, `"`, special chars renders without breaking subgraph syntax |
| `detectWorkspaces` setup.py paths | unit — fixture with setup.py only / both pyproject+setup.py / setup.py with regex-unfriendly name |
| `extractSetupPyName` regex variants | unit — `name="x"`, `name='x'`, `name=PKG_NAME`, `name=open(...).read()`, missing name |
| `SETUP_PY_NAME_UNRESOLVED` warning surfaces | integration — workspace with regex-unfriendly setup.py → workspaceWarning entry with diagId in WS broadcast |
| Mixed-language fixture `monorepo-3pkg-mixed/` | integration — new fixture at `packages/test-utils/fixtures/monorepo-3pkg-mixed/`: pkg-a (TS), pkg-b (TS, imports pkg-a), pkg-c (Python with `setup.py` only) → renders with mixed-language subgraphs |
| Dogfood smoke (LOCAL) | E2E — codeflow repo verified mode → ≥10 subgraphs in rendered Mermaid output, ≥1 cross-subgraph edge |

### 6.5 PR3 acceptance gate

- ✅ All PR3 tests green
- ✅ Mermaid output for codeflow repo renders 10 named subgraphs in browser (manually verified)
- ✅ Cross-subgraph edges render correctly (manually verified via browser)
- ✅ Mixed-language fixture (TS+Py) produces single connected graph
- ✅ `setup.py` with regex-friendly name extracts displayName correctly
- ✅ `setup.py` with regex-unfriendly name produces fallback displayName + workspaceWarning
- ✅ Mermaid version pinned if needed
- ✅ No regressions in PR1/PR2 acceptance criteria

---

## 7. Cross-cutting decisions

### 7.1 Backward compatibility

- **IR schema:** all PR2/PR3 additions are optional fields; `schemaVersion` stays `'1'`. Existing get_ir consumers ignoring new fields continue to work.
- **ExtractorResult:** `workspaceErrors?` is optional; single-workspace callers see empty array, no behavior change.
- **WS broadcast:** `workspaceWarnings?` is optional; existing browser code without the field handler still functions (just doesn't show banner).
- **mcp.ts orchestration:** `runVerifiedExtraction` flow unchanged. Per-workspace fan-out happens INSIDE each extractor.

### 7.2 Spec invariant compliance

| Invariant | How preserved |
|---|---|
| §3 "one file on disk → one node in merged graph" | `reRootIR` rewrites all path-derived fields including `Relationship.source.file` and `CFSymbol.absPath`; canonicalizer's `byId` remap covers the rest |
| §10 Edge identity `(fromSymbolId, toSymbolId, kind)` | File-symbol synthesis in PR1 ensures `from` is always a symbol id; merger's existing dedup unchanged |
| §11 Lane-scoped error rule | Extractor always returns `ExtractorResult` with `partial: true` on full lane failure; never throws |
| §11 Share-per-path | Canonical-key resolution prevents nested-path overlap |
| §12.1 Never fail silently | All per-workspace failures emit `workspaceWarnings`; setup.py regex failure emits explicit warning code |
| §12 Diag bundle dedup `(code, lane)` | Preserved; per-workspace context aggregated in `context.workspaces[]`, not extending the dedup key |
| §14 CI plugin-install smoke | Unaffected; PR2 adds new CI install steps for scip-typescript binary but doesn't touch plugin-install gate |

### 7.3 Pre-coding verifications (gate before PR1 starts)

The Phase 0 script in PR1 §4.1 is the primary verification. Additional pre-coding checks `[review-2 verifications]`:

1. SCIP role bitmask values for actual import statements (PR1 §4.1.1)
2. SCIP symbol-string stability across export patterns (PR1 §4.1.2)
3. SCIP symbol-string stability between root-with-references vs separate-leaf invocations (PR1 §4.1.3)
4. `child_process.spawn` cancellation semantics on macOS + Linux — confirm zombies vs cleanup (PR2 §5.3 implementation requires this)
5. Mermaid version vendored in `packages/preview/` — cross-subgraph rendering correctness (PR3 §6.3)

Findings #1-3 happen in Phase 0. Findings #4-5 happen during their respective PRs' implementation phase as test-driven verifications.

### 7.4 Concurrency caps & resource ceiling

- **Verified lane:** parallel cap = `min(4, cpus().length)` — bounded to avoid OOM regression (commit `9c706dc fix: depcruise OOM/noise` already burned a fix on this) `[review-1 C3]`
- **Lane budget:** 5 min global; cancels all remaining and in-flight subprocesses with SIGTERM→SIGKILL
- **Per-workspace timeout:** 90s (matches existing extractor timeout)
- **Memory ceiling estimate:** scip-typescript ~1-2GB resident on large packages × 4 parallel = 4-8GB peak; safely below typical 16-32GB machine RAM

### 7.5 Scope of `scip-python` parity

PR1 and PR2 implement the same patterns for `scip-python` as for `scip-typescript`. `scip-python` does not have tsconfig-style `references`, so `isLeaf` is always `true` for all detected Python workspaces. Phase 0 verification (PR1 §4.1) runs on Python fixtures too.

PR3 adds Python-specific `setup.py` detection. No `scip-python` invocation changes in PR3.

---

## 8. Out of scope (this design)

- Mermaid `subgraph` nesting (apps/web/api as nested subgraphs) — visual refinement, v1.1
- `--workspaces` CLI glob flag — no demand, partial-fail covers exclusion
- Workspace-level caching / incremental indexing — own design problem (cache invalidation correctness)
- Conda env / `requirements.txt`-only Python projects — pyproject + setup.py covers ~all real cases
- Self-implemented tsconfig project-reference traversal — trust scip-typescript, leverage via `isLeaf`
- Cross-workspace symbol re-resolution beyond what scip-typescript emits — Phase 0 verifies the upstream tool already handles it

---

## 9. Open verification items (kicked to implementation)

1. Phase 0 script empirical results (PR1 gate)
2. `child_process.spawn` cancellation behavior cross-platform (PR2 implementation)
3. Mermaid version pinning if cross-subgraph rendering broken on vendored version (PR3 implementation)

If any of these come back unfavorably, the affected PR pauses and design is revisited before code lands.

---

## 10. References

- v1 spec: [`2026-04-23-codeflow-v1-design.md`](./2026-04-23-codeflow-v1-design.md)
- Trigger session: 2026-04-29 verified-mode failure on codeflow repo itself
- Pre-mortem reviews: round 1 (initial design), round 2 (revised design with subgraphs+setup.py folded in)
- SCIP protobuf: sourcegraph/scip `scip.proto` — `SymbolRole` bitmask reference
- pnpm workspace lib: `@pnpm/find-workspace-packages`
