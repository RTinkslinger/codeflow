# Checkpoint
*Written: 2026-04-26 05:30*

## Current Task
Ship a working codeflow plugin v0.1.8 to GitHub and verify end-to-end with `/flow`.

## Progress
- [x] Bug #1: depcruise `--exclude '^(node_modules|\.git)'` added, `root` used instead of `opts.path`
- [x] Bug #3: verified lane empty-IR guard changed to `irs.some(ir => ir.symbols.length > 0)`
- [x] Bug #4: `coreModule` and `couldNotResolve` skipped in module loop
- [x] Bug #5: `scip` added to doctor tools
- [x] Fix: `.mcp.json` changed from shell-script command to `node` + `args` (CC invokes with node directly)
- [x] Fix: `plugin.json` version was stuck at `0.1.3` — identified as the installer's authoritative version source
- [x] v0.1.8 published to `RTinkslinger/codeflow` release branch (commit `2472783`)
- [x] README updated with full install/usage/diagnostics instructions
- [x] Release SOP memory updated (all 3 version files: `plugin.json`, `marketplace.json` x2, `package.json`)
- [ ] End-to-end test: `/flow` on a real project after Claude Code restart

## Key Decisions (not yet persisted)
All decisions already persisted to memory files.

## Next Steps
1. Restart Claude Code (required — MCP server process is not spawned until next session launch)
2. In the new session, run `/flow /Users/Aakash/Claude\ Projects/codeflow` (or any TS project with tsconfig.json)
3. Verify fast view appears in browser (~1s, dashed edges)
4. Optionally run `/flow <path> --verified` to test verified lane

## Context
- Plugin installed at project scope: `~/.claude/plugins/cache/codeflow/codeflow/0.1.8/`
- `node ~/.claude/plugins/cache/codeflow/codeflow/0.1.8/packages/cli/dist/main.js --version` returns `0.1.8` ✓
- MCP config: `{ "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/packages/cli/dist/main.js"] }`
- Main branch is clean except for the new test files (untracked: `mcp.empty-ir.test.ts`, `index.invocation.test.ts`) and `server.test.ts` modification — these need to be committed to main before next feature work
