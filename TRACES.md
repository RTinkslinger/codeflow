# TRACES

## 2026-04-26 — Session: empty mermaid + plugin release fixes

### What changed
- `packages/preview/src/ws.ts` — `WSBroadcaster` stores `lastMessage` and replays to new connections. Fixes race condition where extraction completes before browser WebSocket connects.
- `packages/preview/src/ws.test.ts` — test for late-connection replay (was missing)
- `scripts/build-plugin.ts` — now stages `package.json` + `.claude-plugin/` before the release commit, so version bumps actually land in the release files (was only staging dist/ + node_modules/)

### Root cause found
`WSBroadcaster.broadcast()` iterated `this.wss.clients` at call time. When fast extraction (~1s) finished before the browser opened the WebSocket, the message was sent to 0 clients and lost. Browser showed empty diagram indefinitely.

### Known gaps going in to next session
- Browser HTML (`PREVIEW_HTML` in `packages/preview/src/server.ts`) doesn't handle `verified_ready` message type — verified lane wired server-side, silently ignored in browser
- `scip-typescript` / `scip-python` binaries not installed — verified lane untested
- Plugin installer pins to registered version; each release requires clearing cache manually

### Lesson
Never kill the MCP server process within a session. Claude Code marks it permanently crashed and `/mcp reconnect` fails. Patch on disk only; let the natural session boundary handle reload.

---

## 2026-04-26 — Session: verified_ready handler + test oracle

### What changed
- `packages/preview/src/server.ts` — added `verified_ready` branch to `ws.onmessage` in `PREVIEW_HTML`; also exported `PREVIEW_HTML` constant to enable direct test access
- `packages/preview/src/server.test.ts` — rewrote the `verified_ready` test using `vm.runInContext` with stubbed browser globals; asserts four DOM mutations (diagram.innerHTML, label.textContent, dot.className, mermaid.run call count). Previous string-presence oracle was REVISE'd by test-reviewer; vm-based oracle got PASS.
- `packages/preview/src/ws.ts` + `ws.test.ts` — promoted from main branch to release branch (source was on main since b0c7292 but release branch had old version)
- Released as v0.1.5 on release branch (38c7c80); compiled output patched directly into installed plugin cache

### Key decisions
- `vm.runInContext` is the right test scope for PREVIEW_HTML handler behavior — no Playwright needed. Stubbed `WebSocket`, `document`, `mermaid`, `sessionStorage`, `location` globals + outer `Promise` for cross-context async.
- `as string` cast required on `match()[1]` — TypeScript strict mode flags it as `string | undefined` even after `!` non-null assertion on the array.
- Release branch source files must be kept in sync with main manually (`git checkout main -- <files>`) because the branches have diverged histories (common ancestor at 8414315). Do NOT try to `git merge main` without resolving conflicts first.

### Known gaps going in to next session
- `@sourcegraph/scip-python` not yet installed (npm package, not pip) — `npm install -g @sourcegraph/scip-python`
- Plugin cache shows 0.1.3 in `claude plugin list` — installer quirk (marketplace registered at 0.1.3). Cache contents are patched with v0.1.5 compiled files; behavior is correct even though version label is wrong.
- Shell broken in this session (deleted plugin cache dir which was bash's cwd). New session needed.
- MCP server not yet reloaded — needs Claude Code restart to pick up patched dist files.

### Lesson
Never `rm -rf` a directory that is the active bash shell's working directory. The shell's cwd becomes invalid and ALL subsequent bash commands fail with "Working directory does not exist." The fix is restarting Claude Code — but it kills the session. Prefer patching files in-place over delete+reinstall when the directory is the session cwd.

---

## 2026-04-26 — Session: MCP registration RCA + v0.1.10 fix

### What changed
- `.mcp.json` — changed from `{ "mcpServers": { "codeflow": {...} } }` to flat `{ "codeflow": { "command": "node", "args": [...] } }`. The `mcpServers` wrapper is for HTTP-type only; stdio plugins require flat format.
- `.claude-plugin/marketplace.json` — added `mcpServers` to `plugins[0]` (qmd pattern); bumped to 0.1.10
- `.claude-plugin/plugin.json` — bumped to 0.1.10
- `package.json` — bumped to 0.1.10
- `bin/codeflow-mcp` — deleted; shell script wrapper was unnecessary, `node` direct invocation is correct
- `.rca/` — canonical root cause analysis record from /rca skill
- `MEMORY.md` — project memory index

### Root causes found (via /rca, 3 judges, all accept-with-caveats)
**H1 (high confidence, root since day 1):** `.mcp.json` used `{ "mcpServers": {...} }` wrapper. CC requires flat `{ "serverName": {...} }` for stdio plugin MCPs. The wrapper is only valid for HTTP transport (vercel, supabase). Working stdio plugins (playwright, context7) all use the flat format. This mismatch was in the initial scaffold commit `356ddc5` and persisted through all versions.

**H2 (medium, 0.1.9 regression):** commit `ac828a4` changed `command` from `"node"` to `"${CLAUDE_PLUGIN_ROOT}/bin/codeflow-mcp"`. Reverted. Direct `node` invocation with path in `args` is the correct pattern.

**H5 (medium, judge-raised):** `marketplace.json > plugins[0]` had no `mcpServers` field. qmd (the only other plugin using marketplace.json for MCP) has it. Added to cover both CC registration paths.

**H3 (open question):** Whether project-scoped `enabledPlugins` (in `.claude/settings.local.json`) is sufficient for MCP server startup — all working stdio MCP plugins are globally enabled; codeflow is the only one project-scoped. Verification in a new CC session will resolve this.

### Prior session assumption that was wrong
Previous session concluded "missing `codeflow@codeflow` from global enabledPlugins" was the primary root cause. This was incorrect — `.claude/settings.local.json` already had the entry for the repo-scoped install. The /rca skill caught this in Round 1.

### Known gaps going in to next session
- **H3 unresolved:** verify that project-scoped enabledPlugins is sufficient for MCP startup (open new CC session, check deferred tools)
- If H3 blocks: add `"codeflow@codeflow": true` to global `~/.claude/settings.json`
- After MCP verified working: run `/flow` end-to-end production test

### Lesson
CC plugin `.mcp.json` format for stdio ≠ standard project `.mcp.json` format. The standard project format (`{ "mcpServers": { ... } }`) is NOT correct for plugin cache `.mcp.json` files. Plugin cache files must use the flat `{ "serverName": { ... } }` format. Only HTTP-transport plugins use the `mcpServers` wrapper in the cache. This is not documented — discovered by comparing working plugins (playwright, context7) against broken ones (codeflow). Use /rca before touching plugin config files; assumptions here have been wrong twice.

---

## 2026-04-29 — Correction to 0.1.10 lesson: flat-format hypothesis was WRONG

### What we found
The 0.1.10 "flat format" conclusion above is incorrect. Authoritative Anthropic docs confirm:

- **[code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)** — both project-scope and plugin-scope `.mcp.json` use the same `{ "mcpServers": {...} }` schema.
- **[code.claude.com/docs/en/plugins-reference](https://code.claude.com/docs/en/plugins-reference)** — same.
- **[code.claude.com/docs/en/plugin-marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)** — `marketplace.json > plugins[].mcpServers` is also valid (advanced plugin entry pattern), same schema.

There is **no documented "flat format"** for any `.mcp.json` in CC.

### Why the broken file appeared to work in 0.1.10
The MCP server registered successfully because `marketplace.json > plugins[0].mcpServers` (added in 0.1.10) was independently doing the registration with the correct wrapped schema. The flat `.mcp.json` was being silently ignored by the plugin loader. /doctor caught the parse failure: `[Failed to parse] Project config (shared via .mcp.json) — mcpServers: Does not adhere to MCP server configuration schema`.

### Comparison to playwright/context7 was a false positive
Those plugins likely have their own correctly-wrapped `.mcp.json` OR rely on marketplace.json registration. The "flat format works" assumption was never directly verified — the conclusion was inferred from observing that 0.1.10 "worked" without checking which file path was actually carrying the registration.

### Fix in 0.1.11
Rewrap `.mcp.json` with `mcpServers` key. Same file at project root and shipped in plugin. /doctor parse error resolves.

### Lesson
**Verify against official docs, not by inference from working systems.** The /rca process in 0.1.10 produced a confident wrong answer because it never consulted code.claude.com directly. Subagent rounds reinforced the inference instead of breaking it. When changing a config schema, **the docs are the ground truth** — comparison to other plugins is a secondary signal at best.

---

## 2026-04-29 — Follow-up v0.1.12: project-root `.mcp.json` removed entirely

### What surfaced after 0.1.11
`/doctor` warning: `[codeflow] mcpServers.codeflow: Missing environment variables: CLAUDE_PLUGIN_ROOT`. The schema fix made the file parseable — and once parseable, CC validated env-var expansions and noticed `${CLAUDE_PLUGIN_ROOT}` is unset in project scope (plugin-scope-only variable).

### Fix
- Inlined `mcpServers` into `.claude-plugin/plugin.json` (per [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp), this is a documented alternate location)
- Deleted project-root `.mcp.json`
- Updated `scripts/build-plugin.ts` to drop `.mcp.json` from `git add`
- `marketplace.json > plugins[0].mcpServers` retained as redundancy

### Why this is the final answer for source-repo-IS-plugin-root setups
Project root and plugin root collide in this repo. Any file CC interprets as both is a problem. By moving MCP config into `.claude-plugin/plugin.json` (not at project root), only the plugin loader reads it — no project-context interpretation, no env-var warnings, no schema confusion.

### Lesson
**When source repo == plugin root, prefer plugin.json inline over .mcp.json at root.** The `.mcp.json` at root is fine for end-users (it lives only in the plugin cache where CLAUDE_PLUGIN_ROOT resolves), but in dev it gets double-parsed. `plugin.json`'s `mcpServers` field avoids the collision entirely.

---

## 2026-04-30 — M2 monorepo extractor (v0.1.13 → v0.1.16): four big lessons

Five-day arc executing `docs/upp/plans/2026-04-29-codeflow-monorepo-extractor.md`. M1 + M2 shipped. M3 deferred.

### Lesson 1 — "Files-only soup" was a load-bearing-invariant bug, masked for months

**Symptom:** v0.1.15 verified-mode graph on the codeflow repo showed 115 file nodes + 1199 dense edges and zero function/class/method Definitions. User flagged "ultra infinite dense soup."

**Root cause:** `canonicalMerge` in `packages/canonical/src/merger.ts` keyed `byPath` on canonicalized absPath WITHOUT checking symbol kind. Two SCIP Definitions in the same file (a function and the file-symbol added by M1) both had the same absPath → the merger collapsed them. Every Definition got remapped to the file-symbol id; the byNonFileId of distinct Definitions never existed.

**Why nobody caught it before now:** M1 introduced file-symbols (Task 3). Before M1, scip extractors emitted only Definitions, all with the same `kind: 'function'`. Two functions sharing absPath was impossible because each function had a distinct SCIP id. Post-M1, file-symbols share absPath with their Definitions → collision triggers the over-broad dedup.

**Fix in v0.1.16:** scope `byPath` to `FILE_LEVEL_KINDS = {file, module}` only. Other kinds dedupe by id. Two file-level symbols for the same path collapse to one (cross-extractor dedup, the original intent). Function/class/method Definitions are preserved.

**Lesson:** spec invariants like "one file on disk → one node" must specify SCOPE. The original wording ambiguously meant "one file-NODE per file," not "one any-symbol per file." Without that scoping, the implementation collapsed legitimately distinct nodes for years. Whenever a load-bearing invariant changes shape (here: M1 introduced a new symbol kind that participates in path-keyed dedup), re-audit the invariant's scope.

### Lesson 2 — Synthetic fixtures hide pnpm-symlink reality

**Symptom:** dogfood test on real codeflow repo (10 packages, pnpm-symlinked deps) returned 0 cross-workspace edges despite the 3-pkg synthetic fixture passing every cross-edge test.

**Root cause:** the 3-pkg fixture used tsconfig `paths` aliases (`"pkg-a": ["../pkg-a/src/index.ts"]`). With paths aliases, scip-typescript indexes pkg-b's import of pkg-a directly to pkg-a's source files — so the SCIP symbol id of pkg-b's reference equals pkg-a's Definition id. Phase 0 verified this case.

But real pnpm workspaces use `node_modules/@codeflow/core` symlinks, not paths aliases. scip-typescript follows the symlink to the BUILT dist (`dist/index.d.ts`), and emits the reference with `dist/...` in the descriptor, while pkg-a's Definition uses `src/...`. Same package, different file path → different SCIP id → the merger's byId table has no match → relationship stays as an unstitched external reference.

**Fix:** added `cross-workspace-stitch.ts` that runs post-merge. Matches relationship `to` field to internal file-symbol via `(pkgName, moduleKey)` where moduleKey strips `src|dist` prefix and `.ts|.d.ts` extension. Empirical SCIP samples documented inline in the source.

**Lesson:** Phase 0's symbol-stability claim was scoped to one pattern (paths aliases) but the spec implicitly assumed it generalized. **Always test verification fixtures against the dominant real-world dependency-resolution pattern**, not a simplified one. For TS monorepos, that's pnpm/yarn/npm symlinks — workspaces:* deps with `link:` resolution.

### Lesson 3 — Subagent execution surfaces real bugs only when given REAL inputs

The dogfood test (Task 26) was almost dropped because the synthetic fixture tests all passed. Running it against the actual codeflow repo found:
- The cross-workspace edge gap (Lesson 2)
- chokidar EMFILE on node_modules (5934 errors)
- Mermaid maxTextSize cap on real-monorepo IR sizes
- The canonicalMerge collapse bug (Lesson 1)

None of these surfaced in synthetic fixtures because the fixtures were too small AND too clean. The dogfood test's value isn't its assertions — it's that running on REAL CODE forces the system through cases the design never imagined.

**Lesson:** plan an "empirical ground-truth gate" between every milestone, not just at the end. Each gate should run on the largest, gnarliest real input available, even if its assertions are loose. The point is to make the system fail in honest ways before users do.

### Lesson 4 — Plan deviations stack up; fold into TRACES regularly

Five real plan deviations during execution:
1. Task 18 ran before Task 17 (sequencing dep)
2. Task 9.5 inserted (user-flagged readability)
3. Task 26.5 added (cross-workspace stitcher, dogfood failure)
4. Task 26.6 added (FileWatcher EMFILE)
5. v0.1.16 merger fix (NOT in plan)

None of these are bad — they're appropriate responses to real findings. But the plan file at `docs/upp/plans/2026-04-29-codeflow-monorepo-extractor.md` doesn't reflect them. Future readers will see "Task 27" and miss that 26.5/26.6 happened in between, that v0.1.16 ships work that's not in any plan task.

**Lesson:** when plan execution deviates (and it will), record the deviation in TRACES.md immediately. The plan file becomes intent-of-the-day; TRACES.md is the executed-reality log. Keep them honest with each other.

### Stats
- 7 versioned releases in this arc (v0.1.10 → v0.1.16)
- ~35 production commits
- 170/173 tests passing; 2 unrelated timing flakes; 1 env-gated dogfood
- 3 days from spec to M2-shipped (with brainstorming + 2 eng-lead review rounds)
