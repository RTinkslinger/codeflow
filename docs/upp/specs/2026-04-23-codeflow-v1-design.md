# codeflow — v1 Design Spec

**Date:** 2026-04-23
**Status:** Approved design, ready for implementation planning in dedicated project folder
**Graduated from:** Jam Sessions (`~/Claude Projects/Jam Sessions/sessions/2026-04-23-*`)

---

## 1. Problem

User runs Claude Code in a terminal and wants: *"I type a prompt in CC and I see a flowchart of my codebase logic."*

The initial research (see synthesis file `2026-04-23-cc-flowchart-synthesis.md`) established three hard constraints from the user:

- **All three use modes, situationally**: reading unfamiliar code + live companion while building + handoff diagrams
- **Must be verifiable**: deterministic extraction required — Claude may annotate, must not invent
- **Polyglot**: most real codebases mix TS, Python, Go, and the user has a specific Swift (iOS/macOS) codebase as the real driver

The research also established what doesn't work:
- Pure-ASCII terminal rendering — CC captures subprocess stdout, so Kitty/Sixel protocols can't reach the browser through CC's chat UI (CC issues #2266 and #14375 are open feature requests from 2025–2026)
- Single-language tools treated as universal — each language needs its own extractor
- LLM-only extraction — hallucinates call edges on dynamic code

The design that follows is what survives those constraints.

---

## 2. Scope

### V1 ships

- **Languages**: TypeScript/JavaScript + Python
- **Diagram type**: module dependency graph (first lane for each language)
- **Modes**: fast default (syntactic extractors) + verified opt-in (type-resolved extractors)
- **Renderer**: Mermaid only (D2 deferred)
- **Display**: browser live-reload (not in-CC inline — CC doesn't support it)
- **Distribution**: CC plugin via `/plugin marketplace add`, UPP-pattern (committed node_modules, no npm publish required)
- **Monorepo support**: kept in v1 (workspace detection walks up from path)

### V1.1 fast-follow (all deferrals — explicit)

- Config hot-reload (restart-CC works)
- Adversarial canonicalizer fixtures (symlink loops, NFC/NFD Unicode)
- Distinct WebSocket channels per `start_preview` call (v1 returns existing previewId on duplicate)
- Opt-in telemetry (design documented; implementation deferred)
- Remaining `CodeflowError` envelope fields (`retryable`, `relatedPreviewId`, `upstreamRef`, `occurrenceCount`)
- `run_doctor` as MCP tool (v1 ships as CLI only)
- Path redaction in logs + 30s debug ring buffer
- Coverage-gap error codes (OOM guard, stderr cap, binary sniff, FS event storm, external-extends allowlist, SIGQUIT-before-SIGKILL)

### V2

- D2 renderer alongside Mermaid
- Cross-language edges (HTTP/fetch pattern-mining, OpenAPI ingest, LLM-inferred — all marked `confidence: inferred`)
- Call-graph diagram type (beyond module deps)
- Incremental re-extraction on save (v1 does full re-run)

### V3

- Control-flow / sequence diagrams
- Architecture / C4 app-code inference
- Go extractor (scip-go primary, go-callvis fallback)

### V4+

- Swift extractor (roll-own tree-sitter-swift — no scip-swift exists as of 2026-04)
- Other languages on demand

---

## 3. Architecture

### Layered flow

```
Slash command ──▶ CLI ──▶ Detection ──▶ Extractors ──▶ IR (per-lane) ──▶ Canonicalizer ──▶ Merger ──▶ Renderer ──▶ Preview
                                                                                                                    │
                                                                                                        ┌───────────┴───────────┐
                                                                                                        │                       │
                                                                                                MCP server (stdio)      HTTP+WS (local port)
                                                                                                        │                       │
                                                                                                        ▼                       ▼
                                                                                                     Claude                   Browser
```

The canonicalizer is a first-class layer (not inline): it enforces "one file on disk → exactly one node in the merged graph" regardless of how many extractors saw it. This is the single invariant that distinguishes codeflow from a naïve merger.

### IR — the load-bearing design decision

SCIP-inspired JSON schema. Graphology-based in-memory. Versioned from day 1.

```ts
type IR = {
  schemaVersion: '1'
  meta: {
    extractor: { name: string, version: string, invocation: string }
    root: string              // workspace anchor — all paths relative to this
  }
  documents: Document[]
  symbols: Symbol[]
  relationships: Relationship[]
}

type Symbol = {
  id: string                  // SCIP Symbol.Descriptor grammar:
                              // scheme.manager.package.descriptor
                              // e.g., "tsc:typescript:src/auth:AuthService#login(string)"
  kind: SymbolKind            // LSP numeric enum (Class=5, Method=6, Function=12, ...)
  name: string
  detail?: string
  absPath: string             // fs.realpath resolved
  relPath: string             // POSIX-normalized, relative to meta.root
  language: 'ts' | 'py' | 'go' | 'swift' | ...   // FIELD, not part of id
  origin: 'extractor' | 'inferred'                // what produced it
  confidence: 'verified' | 'inferred'             // how sure (binary v1)
  parent?: string             // optional hierarchy escape hatch (never children[])
  viz?: Viz                   // DOT-attribute subset for renderer
}

type Relationship = {
  id: string
  from: string                // Symbol.id
  to: string                  // Symbol.id
  kind: 'imports' | 'calls' | 'extends' | 'implements' | 'references'
  source?: { file: string, line: number, col?: number }   // edge provenance
  language: string
  confidence: 'verified' | 'inferred'
  evidence?: string           // optional explanation (v2 LLM annotation)
  viz?: Viz
}

type Viz = {                  // renderer-agnostic — DOT vocabulary subset
  label?: string
  shape?: 'box' | 'ellipse' | 'diamond' | 'database' | 'component'
  style?: 'filled' | 'dashed' | 'rounded' | 'solid'
  color?: string              // hex, stroke color
  fillcolor?: string
  penwidth?: number
  arrowhead?: 'none' | 'normal' | 'vee' | 'diamond'
}
```

**Key design decisions (anchored in research):**

| Decision | Why |
|---|---|
| SCIP `Symbol.Descriptor` for ID | Stable, human-readable, language-agnostic. Proven in production at Sourcegraph. |
| Language as a field, NOT in ID | Polyglot codegen (TS generates `.py` stubs) → one node, not two ghosts |
| LSP numeric `SymbolKind` for `kind` | Editor compatibility without adopting LSP's identity model (LSP lacks stable IDs) |
| Binary `confidence` for v1, extend in v2 | Don't pre-specify tiers you don't yet need |
| Versioned JSON (not protobuf) for v1 | Claude consumes as tool input; user can `cat` during debugging. Migration to protobuf is additive via `schemaVersion`, never breaking. |
| Viz subset from DOT | Renderer-agnostic — one IR payload → Mermaid v1 → D2 v2 losslessly |
| Graphology `MultiDirectedGraph` for in-memory | Native multi-edge (imports + re-exports), TS generics, lossless toJSON/fromJSON, production-proven (sigma.js backend) |
| `Kythe VName` philosophy (separate signature from location) | Informs how Symbol.Descriptor is constructed — not a second identity system |

---

## 4. Package layout

Dev monorepo via pnpm workspaces. Distribution via UPP pattern (committed `node_modules/` in release branch; repo root IS the installable plugin).

### 8 packages + 1 internal + repo-root-is-plugin

```
codeflow/                                      ← repo root = the CC plugin
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .mcp.json                                  ← stdio MCP server declaration
├── commands/                                  ← slash commands (md files)
├── skills/                                    ← skills (md files)
├── bin/codeflow                               ← built artifact for MCP spawn
├── node_modules/                              ← committed in release branch (UPP pattern)
├── packages/
│   ├── core/                                  ← @codeflow/core
│   ├── canonical/                             ← @codeflow/canonical (promoted; load-bearing)
│   ├── extractor-depcruise/                   ← default TS fast-reload
│   ├── extractor-treesitter-python/           ← default Py fast-reload
│   ├── extractor-scip-typescript/             ← opt-in verified TS
│   ├── extractor-scip-python/                 ← opt-in verified Py
│   ├── renderer-mermaid/
│   ├── preview/                               ← HTTP + WS + file watcher
│   ├── cli/                                   ← the codeflow binary
│   └── test-utils/                            ← internal, not published
├── tests/fixtures/                            ← committed fixture repos (6)
├── scripts/build-plugin.ts                    ← release critical-path
└── .github/workflows/                         ← CI
```

### Package responsibilities (one clear purpose each)

| Package | Owns | Does NOT own |
|---|---|---|
| `core` | IR types, schema, Zod validators, extractor interface, config loader, pino logger, merger, subexport `@codeflow/core/schema` | Canonicalization, extraction, rendering, preview |
| `canonical` | Path canonicalizer, Symbol.Descriptor construction, dedupe merger, runtime `InvariantError`, property-based tests | IR types (imports from core) |
| `extractor-depcruise` | Shell out to `dependency-cruiser`, parse JSON → IR | Canonicalization, Python |
| `extractor-treesitter-python` | `web-tree-sitter` walker, syntactic symbol/import extraction | Type resolution, call-target accuracy |
| `extractor-scip-typescript` | Shell out to `scip-typescript`, parse SCIP protobuf → IR | Mermaid, graphology |
| `extractor-scip-python` | Shell out to `scip-python`, parse SCIP protobuf → IR | — |
| `renderer-mermaid` | IR → Mermaid string, DOT-subset viz translation | Extraction, preview server |
| `preview` | HTTP server, WS broadcast with latest-wins buffer, chokidar file watcher | Rendering, extraction |
| `cli` | Arg parsing, MCP JSON-RPC handler, composition of all above | Any domain logic (just orchestration) |
| `test-utils` | `loadFixture`, `irEqual`, `mockExtractorOutput`, `snapshotIR`, `assertInvariants` | — |

---

## 5. Distribution

**UPP-pattern**: monorepo in dev, committed `node_modules/` + built `bin/codeflow` in the release branch. Pattern verified against shipping UPP plugin at `~/Claude Projects/UPP-Plugin/`.

- `/plugin marketplace add RTinkslinger/codeflow` → CC clones repo including node_modules
- Node resolves deps locally from `packages/cli/dist/cli.js`
- No `npm install` runs on user machine
- SCIP binaries (scip-typescript, scip-python) are external deps user installs separately (documented)

**Release process:**
1. Dev on `main` branch with workspace:* protocol
2. Run `scripts/build-plugin.ts` → produces `bin/codeflow` + resolves node_modules in `release` branch
3. Tag + push release branch
4. User installs via marketplace

---

## 6. Operating modes

### Fast (default)

- `@codeflow/extractor-depcruise` (TS) + `@codeflow/extractor-treesitter-python`
- Sub-second per-save reload
- Edges tagged `confidence: inferred`
- Dashed lines in render
- Badge: `● fast view`

### Verified (opt-in)

- `@codeflow/extractor-scip-typescript` + `@codeflow/extractor-scip-python`
- 8–60s typical wall time (cold cache larger)
- Edges tagged `confidence: verified`
- Solid lines
- Badge: `● verified` + diff-summary chip

**Single `start_preview` sets up both lanes.** Verified is a property of the *shared extraction pipeline*, not the preview. Any requester on a given path upgrades it for all previewIds sharing that path.

### Accuracy bar (honest, in product copy)

| Codebase profile | Fast lane | Verified lane |
|---|---|---|
| Well-typed TS | ~70% edge recovery | ~90% |
| Well-typed Python | ~50% | ~80–90% |
| Dynamic Python (metaclasses, monkey-patch) | ~30–50% | ~60–80% |
| Module-dep graph (any) | ~80–90% | ~95% |

Shown in UI as *"Fast view shows ~N inferred edges. Switch to verified for type-resolved accuracy."*

---

## 7. State machine

### Per extractor lane

Five states: `idle | extracting | dirty | error | aborted`

```
  idle ──save──▶ extracting ──ok──▶ idle
                     │      ──fail──▶ error ──save──▶ extracting (retry once, then sticky)
                     │      ──stop──▶ aborted (terminal)
                     │      ──save during──▶ dirty
                     │                         │
                     └──────────── ok ─────────┘ (re-enter extracting; depth 1 max)
```

**Coalesce, never queue.** Multiple saves during `extracting` → `dirty` once. One more extraction after current completes.

### Preview-level status

Derived `worst-of(lanes)` for MCP `status` field:

- Any lane `error` → `status: "error"` — **but only if ALL lanes failed**. Single-lane partial leaves preview in `dirty` so fast-view survives verified failure (see Section 11 lane-scoped rule).
- Any lane `aborted` → `status: "aborted"`
- Any lane `extracting` or `dirty` → `status: "extracting"`
- All lanes `idle` with output → `status: "ready"`

Browser sees per-lane state for UI. Claude sees derived preview-level status in tool responses.

---

## 8. MCP tool surface (5 tools)

### `start_preview(path, type?, options?) → {url, previewId, status}`

Async-first. Returns in <100ms with `status: "extracting"`.

**Tool description (Claude-facing, verbatim):**
> *"URL is live and openable immediately; the diagram is not yet queryable via get_ir. Relay the URL to the user. If you need to reason about graph structure in code, call get_ir(previewId) — it returns {ir: null, status} until extraction completes, then the full IR."*

### `list_previews() → [{previewId, path, type, url, status, lastClientSeen, lastGetIrSeen, lastError?}]`

`lastGetIrSeen` prevents idle GC from stopping previews Claude is actively querying headlessly. `lastError` surfaces post-return errors from async-first pattern.

### `stop_preview(previewId) → {stopped: true, finalStatus}`

SIGTERMs running extractors if no other preview shares the path. Transitions all lanes to `aborted`.

### `get_ir(previewId | path, filter?) → {ir, status, truncated, nextCursor?}`

Extended filter:
```ts
{
  file?: string
  symbolId?: string
  kind?: SymbolKind
  language?: Language
  relationshipKind?: string
  depth?: number              // default 1, max 3
  direction?: "in" | "out" | "both"   // default "both"
  limit?: number              // default 500, cap 5000
  cursor?: string             // pagination (v1.1)
  includeEdges?: boolean      // default true
}
```

During extraction: `{ir: null, status: "extracting", etaMs?}`. On partial: `{ir: <merged>, status: "ready", meta: {partial: true, errors: [...]}}`. Never throws; always structured.

### `render_once(path, type?, format?) → {filePath}`

One-shot, no preview server. For CI / PR artifact use cases.

---

## 9. Data flow scenarios

**A — Cold-start preview (async-first):**
User `/flow module-deps src/` → slash command calls `start_preview` → CC lazy-spawns MCP server → server allocates previewId/port/WS, spawns fast-lane extractors in background, returns URL immediately with `status: "extracting"` → browser shows "extracting..." banner → extractors complete in ~1s → canonicalize → merge → render → WS pushes `ready` → browser renders fast view with dashed edges.

**B — Live reload:** user saves → chokidar 200ms debounce + `awaitWriteFinish` → state machine fast lane `idle → extracting` → canonicalize/merge/render → WS → browser live-reloads. Saves during `extracting` → `dirty`, coalesce to one re-run max.

**C — Partial extractor failure:** subprocess exits non-zero or hits 90s timeout → wrapper captures stderr tail → merger runs on whatever completed → `merged.meta.partial = true` → banner in preview with expandable stderr. Fast view survives verified failure.

**D — `render_once`:** extractors → canonicalize → merge → render → write SVG to disk → return path. No preview server, no WS.

**E — Monorepo:** workspace detection walks from `path` looking for `package.json`, `pyproject.toml`, `tsconfig.json` with workspaces → per-workspace extractor invocation → canonicalizer uses abs path relative to `meta.root` → Mermaid groups via subgraph directive.

**F — Git branch switch:** chokidar fires ~300 events in <1s → debounce coalesces to one extract trigger after 200ms quiet → state machine coalesces any further saves to depth 1 `dirty`.

---

## 10. Verified-diff UX (Option E)

Hybrid of animated diff-first (B) by default + pending-apply (C) on-demand.

| Situation | Behavior |
|---|---|
| First verified arrival per previewId | Full 2s animation: removed edges flash red → fade; added edges pulse in green; inferred edges upgrade amber→green |
| Save-triggered re-run, 1–14 edges changed | Silent swap + `+N / −M / X upgraded` badge chip |
| Save-triggered re-run, 0 or 15+ edges changed | Silent swap, badge chip only |
| User clicks `↻ replay diff` on badge | Animation fires on-demand |
| `require_manual_apply` preference on | Option-C pending card; user must click Apply |

State exposed via WS: `{type: "verified_ready", diff: {added, removed, upgraded}}`. Browser decides animation vs silent swap vs pending card.

**Merger emits diff** as `meta.diff` on merged IR: `{added: Edge[], removed: Edge[], upgraded: Edge[]}`. Edge identity dedup: `(fromSymbolId, toSymbolId, kind)`. Confidence upgrades (inferred → verified) recorded as `upgraded`, never append-dup.

Mockup reference: `sessions/2026-04-23-ux-mockups/index.html` (preserved for future iterations).

---

## 11. Lifecycle, hardening, lane-scoping

### Lifecycle GC

- **Idle timeout**: 10 min with no WS client AND no `get_ir` call → auto `stop_preview`
- **Preview cap**: 8 concurrent; 9th returns error with `list_previews()` payload embedded so Claude can stop one
- **Share-per-path** (v1 simplification): duplicate `start_preview(path)` returns existing `{previewId, url}` rather than distinct WS channel. Distinct channels per call → v1.1.

### Operational hardening

- **Chokidar**: `awaitWriteFinish: {stabilityThreshold: 150, pollInterval: 50}`, ignore `node_modules|.git|.venv|dist|build|target|.next|.parcel-cache` + respect `.gitignore`
- **Linux**: document `fs.inotify.max_user_watches` sysctl bump in README
- **Subprocess timeout**: 90s hard kill per extractor, surfaced through Scenario C partial-failure path
- **Port allocation**: try 7800–7900 sequentially; `:0` OS-assigned fallback; return resolved port
- **WS backpressure**: single-slot latest-wins send buffer per client — rapid reloads never stack
- **Logging**: pino → `~/.codeflow/logs/server-YYYY-MM-DD.log`, NEVER stdout
- **CC restart**: browser WS reconnects with exponential backoff; server on respawn treats all old previewIds as stale; browser receives `{type: "stale", action: "reload"}` → user re-triggers preview

### Lane-scoped error rule

Partial failure in one lane **never** escalates preview state beyond `dirty` unless ALL lanes fail. Fast-view dashed-edges diagram survives verified-lane failure. Banner shows "verified extraction failed — showing fast view."

---

## 12. Error handling

### Principles

1. Never fail silently — partial always shows a banner.
2. Every error has stable `code` + short `diagId` that surfaces in UI and logs.
3. Messages lead with "what to do next."
4. Distinguish user-environment from internal bugs.
5. Logging is sacred-stream-safe (pino files only; never `console.*`).

### Envelope

```ts
type CodeflowError = {
  code: string                          // 'EXTRACTOR_NOT_FOUND', etc.
  category: ErrorCategory               // one of 9
  severity: 'fatal' | 'partial' | 'warning'
  title: string
  detail: string
  nextStep: string                      // always present
  context: Record<string, unknown>
  diagId: string                        // short UUID
  timestamp: string                     // ISO 8601 UTC
  docsUrl: string                       // stable per-code documentation URL
}
```

v1.1 adds: `retryable: 'no' | 'same-call' | 'after-fix'`, `relatedPreviewId?`, `upstreamRef?: {tool, version, issueUrl?}`, `occurrenceCount?: number`, `firstSeenAt?: string`.

### 9 categories (MECE)

| Category | Examples | Severity default |
|---|---|---|
| setup | `PLUGIN_INCOMPLETE_INSTALL`, `NODE_MODULES_MISSING` | fatal |
| dependency | `EXTRACTOR_NOT_FOUND`, `SCIP_BINARY_MISSING` | partial |
| extraction | `SOURCE_PARSE_FAILED`, `TSCONFIG_INCOMPATIBLE`, `SCIP_PARSE_FAILED`, `EMPTY_OUTPUT` | partial |
| timeout | `SUBPROCESS_TIMEOUT_90S`, `EXTRACTION_QUEUE_BLOCKED` | partial |
| invariant | `CANONICAL_ID_COLLISION`, `MERGER_ORPHANED_EDGE` | fatal |
| input | `MALFORMED_CONFIG`, `INVALID_OPTION` | fatal |
| filesystem | `PATH_NOT_FOUND`, `NO_SUPPORTED_FILES`, `DISK_FULL`, `PERMISSION_DENIED` | fatal |
| upstream | `SCIP_PYTHON_UPSTREAM_BUG`, `DEPCRUISE_UPSTREAM_REGRESSION` | partial, with `upstreamRef` (v1.1) |
| runtime | `PORT_EXHAUSTED`, `INOTIFY_LIMIT`, `FS_EVENTS_DEAD` | partial |

`mcp` errors (unknown previewId, preview cap reached) are tool-response only, severity `warning`, NOT enveloped as `CodeflowError`.

### Severity behavior

- **fatal** → `{ok: false, error}` — preview closes, state → `error`, diag bundle auto-saved
- **partial** → `{ok: true, data, warnings: [error]}` — graph renders with banner, state stays `idle` so next save retries, diag saved per dedup rule
- **warning** → logged + banner, no diag bundle

### Async error delivery

Errors arriving after `start_preview` returned (extractor fails 5–30s later) surface via three channels:

1. **WebSocket push**: `{type: "error", error: CodeflowError}` — same envelope shape
2. **Preview-level state** → `error` (lane-scoped per Section 11), visible via `list_previews`
3. **Persistent `lastError`** on the preview object → `list_previews` returns `lastError?: CodeflowError`

### Diagnostic bundle dedup rule

`(code, lane)` dedup key. Cap **3 bundles per code per session**. Summary bundle at session end if any code fired >10×.

Same code 10× on 10 files → 1 bundle with `occurrenceCount: 10` + rolling sample of 3 contexts. Two different codes → 2 bundles. Same code across lanes → treated distinctly.

### Bundle contents

Saved to `~/.codeflow/diagnostics/<diagId>/`:
- `error.json` — envelope
- `context.json` — full context data
- `ir-partial.json` — IR at time of error (if any)
- `subprocess-stderr.txt` — tail of failing subprocess
- `log-tail.ndjson` — last 200 log lines
- `env.json` — node version, OS, tool versions, inotify limit, `TERM_PROGRAM`

30-day retention, 100-bundle cap (oldest evicted). **No auto-upload.**

### `codeflow doctor` CLI (v1)

- default: environment audit (node, OS, extractors on PATH + versions, inotify limit, recent errors, config validation)
- `--bundle <diagId>`: zip + print pre-filled GitHub issue URL

v1.1 adds `run_doctor` as MCP tool wrapping the CLI for direct Claude invocation.

---

## 13. Logging

- **Framework**: pino (structured NDJSON)
- **Path**: `~/.codeflow/logs/server-YYYY-MM-DD.log`
- **Levels**: fatal / error / warn / info (default) / debug / trace
- **Rotation**: 50MB cap per file (rotates with `-N` suffix in-day)
- **Retention**: 14 days then auto-deleted
- **Pretty format**: `CODEFLOW_LOG_PRETTY=1` enables pino-pretty for dev
- **Pretty CLI**: `codeflow logs tail` pipes through pino-pretty
- **Standard fields on every line**: `{ts, level, previewId?, path?, lane?, diagId?, code?, msg, ...}`

v1.1 adds path redaction (`$HOME` → `~`, workspace-abs → workspace-rel) and 30s debug ring buffer flushed to bundle on error.

---

## 14. Testing

### Tools

| Tool | Use | Why |
|---|---|---|
| vitest | All unit + integration across packages | Native TS, ESM-first, watch mode, fast |
| fast-check | Property-based tests for canonicalizer | De facto JS/TS property testing |
| playwright | E2E (browser + preview server) | One library that reliably tests live-reload |

### Fixtures (6 repos, ~400KB total, committed)

- `pure-ts/` — 20 TS files, baseline
- `pure-py-typed/` — 30 Py files, well-typed
- `pure-py-dynamic/` — metaclass-heavy, exercises confidence marking
- `mixed-ts-py/` — both languages present
- **`ts-codegen-py/`** — TS generates `.py` stubs. Canonicalizer dedupe stress test. If merger produces duplicate nodes on this fixture, v1 is not shippable.
- `monorepo/` — nested workspaces, Scenario E

### Per-package targets (realistic coverage minimums)

- `canonical` — 95% (load-bearing; fast-check + golden fixtures)
- `core` — 80%
- Extractors — 70%
- Renderer — 85%
- Preview — 70%
- CLI — 60%

### CI critical path

Plugin-install smoke test on every PR to `release` branch:
```bash
git clone $REPO /tmp/clone
ls /tmp/clone/node_modules/graphology              # MUST exist
ls /tmp/clone/packages/cli/dist/cli.js            # MUST exist
node /tmp/clone/packages/cli/dist/cli.js --version  # MUST exit 0
timeout 30 node /tmp/clone/packages/cli/dist/cli.js \
  render_once /tmp/clone/tests/fixtures/pure-ts/   # MUST produce valid SVG
```

If any step fails → CI blocks merge.

### CI workflows

- `ci.yml` — every PR: lint + unit + integration (<5 min budget)
- `release.yml` — on tag: build dist + commit node_modules + create release
- `smoke.yml` — PR to release: plugin install smoke test
- `e2e.yml` — nightly: playwright on macOS + Linux (<30 min budget)

---

## 15. Known unsolved problems

1. **Dynamic Python hallucination**: scip-python is conservative on metaclasses / monkey-patching. Honest bar: 60–80% edge recovery on dynamic code. Must be communicated in product copy, not hidden.
2. **Swift has no scip-swift**: v4+ roll-own via tree-sitter-swift. IR is extractor-agnostic, so slot-in fits.
3. **Cross-language edges (TS calling Python service)**: deferred to v2. v1 shows fragmented per-language graphs on shared paths with language-color-coded nodes.
4. **Verified lane pruning inferred edges mid-session**: mitigated via Option E first-arrival animation + diff metadata; still requires user attention at that moment.
5. **MCP tool-call timeout (~60s default)**: mitigated via async-first `start_preview` returning in <100ms. But user's CC config could lower timeout — document the floor.

---

## 16. Open questions (to resolve during implementation planning)

1. LSP `SymbolKind` — adopt numeric enum verbatim (LSP-exact) or mirror as string enum (debuggable JSON)? Numeric wins for wire-compactness; string wins for debug UX. Decide at writing-plans time.
2. Does `scip-typescript` output map cleanly to module-dep-only view without walking every `Occurrence.role`? If not, retain `depcruise` as parallel extractor for module-deps even in verified mode.
3. `veelenga/claude-mermaid`'s preview server code — cleanly extractable via fork, or reimplement from scratch? Affects Section 4's attribution and whether `preview/` package has upstream sync concerns.
4. Exact benchmark data from `scip-python` on a real Python codebase vs the "60–80% dynamic" range in §15.1 — worth a spike before v1.
5. `bin/codeflow` build strategy: `bun build` to single-file vs `tsc` + committed `dist/` with require trees? Bun is simpler; tsc is universally portable. Decide at implementation time.

---

## 17. Graduating out of Jam Sessions

This spec is the load-bearing artifact of the jam. Per Jam Sessions' CLAUDE.md rule, the project now graduates to its own folder: `~/Claude Projects/codeflow/`. That folder will have its own `CLAUDE.md`, a copy of this spec at `docs/upp/specs/`, and will be the site of subsequent work (writing-plans, executing-plans, TDD).

**What's saved in Jam Sessions (historical record):**

- `2026-04-23-cc-flowchart-diagramming.md` / `.json` — initial research (ultra-fast)
- `2026-04-23-cc-flowchart-synthesis.md` — first-layer synthesis + open-question investigation
- `2026-04-23-research-graph-libs.md` / `.json` — graphology vs alternatives research
- `2026-04-23-research-python-extractors.md` / `.json` — Python extractor comparative research
- `2026-04-23-research-prior-art-irs.md` / `.json` — SCIP/LSIF/LSP/Kythe/etc. research
- `2026-04-23-ir-python-priorart-synthesis.md` — FULL mode synthesis of above three
- `2026-04-23-ux-mockups/index.html` — interactive UX mockups (A/B/C/D for verified-diff)
- `2026-04-23-codeflow-v1-spec.md` — **this file**

**What goes in the new project folder:**
- `CLAUDE.md` — project conventions
- `README.md` — short human-readable intro
- `docs/upp/specs/2026-04-23-codeflow-v1-design.md` — copy of this spec

**Terminal state per brainstorming skill:** invoke `writing-plans` in the new project folder. NOT here.
