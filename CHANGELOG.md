# Changelog

## v0.1.18 — 2026-04-30

**Fix: "Syntax error in text" on TS codebases with `<constructor>`, `<get>X`, or generics in symbol names**

`renderer-mermaid` now escapes `<`, `>`, and `&` in node and subgraph labels. Mermaid renders labels as HTML by default (`htmlLabels: true`) and was treating `<constructor>`, `<T>`, `<get>state` etc. as HTML tags — causing a silent parse failure. Bug pre-existed v0.1.16's canonicalMerge fix but was hidden because Definitions were collapsing into file-symbols (whose names don't contain `<`/`>`).

## v0.1.17 — 2026-04-30

**M3: Mermaid subgraphs + setup.py legacy support**

Monorepo graphs are now visually grouped — each workspace renders in its own labeled subgraph instead of a flat node mesh. Cross-workspace edges still resolve correctly across subgraph boundaries.

- **Workspace subgraphs in Mermaid** (`renderer-mermaid`): Symbols are grouped by `workspaceRel` into named `subgraph ws_<name>` blocks using each workspace's `displayName`. Symbols without a workspaceRel render at root. Mermaid pinned to `@11` major for reliable cross-subgraph edge routing.
- **`setup.py` workspace detection** (`canonical`): Python projects using legacy `setup.py` (without `pyproject.toml`) are now detected via static name extraction. Variable or computed `name=` expressions surface as a `SETUP_PY_NAME_UNRESOLVED` warning in the WS broadcast. Cache invalidation includes `setup.py` mtime so edits trigger re-detection.
- **Mixed-language fixture** (`test-utils`): New `monorepo-3pkg-mixed` covering pnpm workspaces alongside a setup.py-only Python package; integration test verifies all three workspaces detected with correct manifest types.

## v0.1.16 — 2026-04-29

**Fix: graph showing files-only "soup" — function/class definitions were collapsing**

`canonicalMerge`'s path-keyed dedup was scoped to all symbols, which silently collapsed every Definition (function/class/method) into its file-symbol — leaving graphs with only file nodes. Fix scopes path dedup to file-level kinds (`file`, `module`) only; non-file symbols dedupe by id. Definitions now appear as distinct nodes.

## v0.1.15 — 2026-04-29

**Fix: Mermaid "Maximum text size in diagram exceeded" on real monorepos**

Codeflow's own IR (~2k symbols / 8k edges) exceeded Mermaid's 50KB / 500-edge defaults. Bumped to `maxTextSize: 5MB` / `maxEdges: 10_000`. Sampling/collapsing for huge projects deferred to v1.1.

## v0.1.14 — 2026-04-29

**M2: monorepo extraction — per-workspace fan-out + cross-workspace edges**

scip-typescript and scip-python now run once per workspace rather than once at the repo root. This fixes "missing edges across workspaces" on pnpm/uv/pdm/rye monorepos — each workspace gets its own SCIP index, results are merged, and a stitcher rewrites cross-package external symbols to internal file-symbols by matching `(pkgName, moduleKey)`.

- Workspace detection: `pnpm-workspace.yaml`, `package.json#workspaces`, `pyproject.toml` (uv/pdm/rye), and fs-walk fallback. Memoized on manifest mtimes.
- Concurrency: `runPerWorkspace` with AbortSignal contract for child-process cancellation.
- Schema additions: optional `CFSymbol.workspaceRel` and `IRMeta.workspaces` (additive; preserves schemaVersion).
- Cross-workspace edge stitcher: matches external SCIP symbols by package name + module key to rewrite to internal file-symbols.
- WS broadcast: `workspaceWarnings` field surfaces partial extraction failures.
- FileWatcher: `followSymlinks: false` + `depth: 10` to prevent EMFILE on real monorepos.

## v0.1.13 — 2026-04-28

**M1: SCIP relationship extraction foundation**

scip-typescript and scip-python now emit `Import` and `Reference` relationships, not just symbols. File-symbols are synthesized as relationship endpoints. Phase 0 verification confirmed cross-workspace symbol-stability.

- Human-readable SCIP symbol names (was emitting raw IDs like `scip_typescript_npm_pkg_a_0_0_0_src__index_ts__defaultGreeti`; now emits `defaultGreeting`).
- Property test: every `relationship.from` resolves via `byId` after merger remap.

## v0.1.12 — 2026-04-29

**Fix: `/doctor` warning "mcpServers.codeflow: Missing environment variables: CLAUDE_PLUGIN_ROOT"**

Project-scope `.mcp.json` parser tries to expand `${CLAUDE_PLUGIN_ROOT}` but the variable is plugin-scope only. Removed project-root `.mcp.json` entirely; `mcpServers` now lives inline in `.claude-plugin/plugin.json` (officially documented alternate location). `marketplace.json > plugins[0].mcpServers` retained for redundancy.

## v0.1.11 — 2026-04-29

**Fix: `/doctor` schema parse error on `.mcp.json`**

`.mcp.json` shipped with a flat schema (was incorrect per official MCP config schema). Rewrapped with the required `mcpServers` key.

## v0.1.10 — 2026-04-28

**MCP server registration — defense-in-depth**

Added `mcpServers` to `marketplace.json > plugins[0]` (the documented "advanced plugin entry" location). Plugin still ships with `.mcp.json` at project root for project-scope discovery.

## v0.1.9 — 2026-04-26

**Bug fixes: 7 correctness issues from adversarial review**

- **Fast lane empty-IR guard**: `runFastExtraction` now uses `irs.some(ir => ir.symbols.length > 0)` (was `irs.length > 0`), matching the verified lane fix from v0.1.6
- **Stale verifiedIR after failure**: both failure branches in `runVerifiedExtraction` now clear `record.verifiedIR = null` so `getIR` falls through to fastIR after a re-extraction failure
- **depcruise `--exclude` regex**: changed from `^(node_modules|\.git)` to `(^|/)(node_modules|\.git)(/|$)` — the old pattern missed pnpm workspace nested paths like `packages/cli/node_modules/`
- **`doctor` CLI subcommand**: `node dist/main.js doctor` now works — outputs a JSON diagnostics report; previously fell through to MCP stdio mode
- **build-plugin.ts version sync**: script now validates that `package.json`, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json` all match before staging the release
- **`CHECKPOINT.md` gitignored**: added to `.gitignore` alongside `TRACES.md`
- **README fixes**: removed non-existent `/flow doctor` command reference, fixed bash doctor invocation to use explicit version path

## v0.1.8 — 2026-04-26

**Fix: plugin cache directory named incorrectly**

The CC installer reads `.claude-plugin/plugin.json` to name the cache directory. This file was stuck at `0.1.3` while `package.json` and `marketplace.json` were being bumped. All three files are now kept in sync on every release.

## v0.1.7 — 2026-04-26

**Fix: MCP server fails to start**

CC invokes the MCP command via `node` directly. The previous `.mcp.json` pointed to a shell script wrapper (`bin/codeflow-mcp`), which caused a `SyntaxError: Unexpected identifier '$'`. Fixed by pointing `.mcp.json` directly to `packages/cli/dist/main.js`.

## v0.1.6 — 2026-04-26

**Bug fixes: depcruise OOM, verified lane, MCP server startup**

- **depcruise OOM on large repos**: added `--exclude '^(node_modules|\.git)'` to depcruise args; pass canonicalized `root` path instead of `opts.path` (fixes macOS symlink mismatch where `/var/folders/...` vs `/private/var/folders/...` caused exclude patterns not to match)
- **Verified lane always empty**: guard changed from `irs.length > 0` to `irs.some(ir => ir.symbols.length > 0)` — scip extractors always return `documents: []`, only `symbols` is populated
- **Phantom symbols from Node core / unresolvable imports**: skip modules where `coreModule: true` or `couldNotResolve: true`
- **Doctor**: added `scip` binary check alongside `scip-typescript` and `scip-python`

## v0.1.5 and earlier

Initial implementation: MCP server, dual-lane extraction (fast + verified), live browser preview, depcruise + tree-sitter + scip-typescript + scip-python extractors, Mermaid renderer, file watcher, idle GC.
