# Changelog

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
