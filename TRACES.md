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
