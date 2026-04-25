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
