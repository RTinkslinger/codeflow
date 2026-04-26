---
rca_id: 7305727e-ed4c-4f54-rca1-codeflow-mcp-001
created: 2026-04-26T08:00:00Z
target: "codeflow plugin MCP tools (mcp__plugin_codeflow_codeflow__*) do not appear in CC session deferred tools list; plugin is installed repo-scoped"
target_type: description
status: resolved
verdict: "Plugin cache .mcp.json uses {mcpServers:{...}} wrapper — CC requires flat {serverName:{...}} format for stdio plugin MCPs; compounded by missing mcpServers field in marketplace.json>plugins[0] and unverified project-scoped enabledPlugins sufficiency"
canonical_source: majority-3
judge_agreement: 100% (all accept-with-caveats)
investigation_rounds: 3
---

## 1. Neutralized query

Why do codeflow MCP tools not appear in CC session deferred tools list; identify structural failure in the plugin's `.mcp.json` and MCP server registration for a plugin installed via project-scoped `enabledPlugins` (`.claude/settings.local.json`), not global settings. Do not pre-assume global enabledPlugins as the cause.

## 2. First-pass analysis

### Hypotheses

- **H1:** The plugin cache `.mcp.json` uses `{ "mcpServers": { "codeflow": { ... } } }` wrapper, but CC requires flat `{ "codeflow": { ... } }` format for stdio plugin MCPs. This mismatch has been present since the initial scaffold commit (`356ddc5`) — both 0.1.8 and 0.1.9 cache files have this wrapper.
  - Confidence: **high** — E1, E2 (working stdio = no wrapper), E5, E6 (broken stdio = has wrapper), E8 (playwright needs no marketplace.json → reads flat .mcp.json → works)
  - Falsification criterion: find a working stdio plugin whose cache `.mcp.json` uses the `mcpServers` wrapper

- **H2:** In 0.1.9, `command` is `"${CLAUDE_PLUGIN_ROOT}/bin/codeflow-mcp"` (shell script path). CC may not be able to exec a shell script without a shell interpreter, or variable expansion in `command` fails. Secondary regression introduced in commit `ac828a4`.
  - Confidence: **medium** — E6, E10, E11 support; SOP memory says "command is just `'node'` — not a shell script path"; weakened by safety evaluator finding that `${CLAUDE_PLUGIN_ROOT}` IS expanded in command fields per plugin-dev docs
  - Falsification criterion: evidence CC expands variables in `command` field AND can exec POSIX shebang scripts

- **H3:** Project-scoped `enabledPlugins` in `.claude/settings.local.json` is insufficient for MCP server startup; CC may only start plugin MCP servers for globally-enabled plugins.
  - Confidence: **medium** (elevated from first-pass low by judge consensus) — E7 shows project-scoped entry exists; all three confirmed-working stdio MCP plugins (playwright, context7, qmd) are globally enabled; codeflow is the ONLY one that is project-scoped only
  - Falsification criterion: documentation or test confirming project-scoped `enabledPlugins` triggers MCP server startup

- **H4 (contrastive):** CC reads ONLY `marketplace.json > plugins[0].mcpServers` for plugin MCPs, ignoring `.mcp.json` entirely.
  - Confidence: **refuted** — E8 (playwright has no marketplace.json but works via flat `.mcp.json`)

- **H5 (judge-raised):** codeflow's `marketplace.json > plugins[0]` has no `mcpServers` field, while qmd's has `{ "qmd": { "command": "qmd", "args": ["mcp"] } }`. If CC reads `marketplace.json` when present and uses `plugins[0].mcpServers`, then finds nothing there, it may not fall back to `.mcp.json`. This would explain why BOTH 0.1.8 (correct `.mcp.json` command) and 0.1.9 failed.
  - Confidence: **medium** — E9 (qmd works via marketplace.json mcpServers), codeflow marketplace.json confirmed to have no mcpServers in plugins[0]
  - Falsification criterion: verify CC falls back to `.mcp.json` even when marketplace.json is present but has no mcpServers

### Evidence table

| id | quote | source | supports | refutes |
|---|---|---|---|---|
| E1 | `{"playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}}` | `~/.claude/plugins/cache/claude-plugins-official/playwright/unknown/.mcp.json` | H1 | H4 |
| E2 | `{"context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp"]}}` | `~/.claude/plugins/cache/claude-plugins-official/context7/unknown/.mcp.json` | H1 | H4 |
| E3 | `{"mcpServers": {"vercel": {"type": "http", "url": "https://mcp.vercel.com", ...}}}` | `~/.claude/plugins/cache/claude-plugins-official/vercel/0.40.0/.mcp.json` | H1-shape(HTTP) | — |
| E4 | `{"mcpServers": {"supabase": {"type": "http", "url": "https://mcp.supabase.com/mcp", ...}}}` | `~/.claude/plugins/cache/claude-plugins-official/supabase/0.1.5/.mcp.json` | H1-shape(HTTP) | — |
| E5 | `{"mcpServers": {"codeflow": {"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/packages/cli/dist/main.js"]}}}` | `~/.claude/plugins/cache/codeflow/codeflow/0.1.8/.mcp.json` | H1 H5 | H2-as-sole-cause |
| E6 | `{"mcpServers": {"codeflow": {"command": "${CLAUDE_PLUGIN_ROOT}/bin/codeflow-mcp", "description": "..."}}}` | `~/.claude/plugins/cache/codeflow/codeflow/0.1.9/.mcp.json` | H1 H2 H5 | — |
| E7 | `{"enabledPlugins": {"codeflow@codeflow": true}}` | `/Users/Aakash/Claude Projects/codeflow/.claude/settings.local.json:11` | H3-precondition | prior-session's "missing enabledPlugins" assumption |
| E8 | playwright cache has only `.claude-plugin/plugin.json` and `.mcp.json`, no marketplace.json; MCP works | `ls ~/.claude/plugins/cache/claude-plugins-official/playwright/unknown/` | — | H4 |
| E9 | `{"qmd": {"command": "qmd", "args": ["mcp"]}}` inside `marketplace.json > plugins[0].mcpServers` | `~/.claude/plugins/cache/qmd/qmd/0.1.0/.claude-plugin/marketplace.json` | H5 | — |
| E10 | commit `ac828a4` "chore: tsx for build script, bin/codeflow-mcp wrapper, fix cli main field and .mcp.json" introduced shell script command | `git log -- .mcp.json` | H2 | — |
| E11 | `{"mcpServers": {"codeflow": {"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/packages/cli/dist/main.js"], "description": "..."}}}` | `git show 356ddc5:.mcp.json` | H1(wrapper from day 1) H2(original node command correct) | — |

### Inconsistency matrix

| | H1 | H2 | H3 | H4 | H5 |
|---|---|---|---|---|---|
| E1 (playwright flat, works) | ✓ | ? | ? | ✗ | ? |
| E2 (context7 flat, works) | ✓ | ? | ? | ✗ | ? |
| E3 (vercel wrapped, HTTP) | ? | ? | ? | ? | ? |
| E4 (supabase wrapped, HTTP) | ? | ? | ? | ? | ? |
| E5 (0.1.8 wrapped, node, broken) | ✓ | ✗ | ? | ? | ✓ |
| E6 (0.1.9 wrapped, script, broken) | ✓ | ✓ | ? | ? | ✓ |
| E7 (project-scoped enabledPlugins) | ? | ? | partial | ? | ? |
| E8 (playwright: no marketplace.json) | ? | ? | ? | ✗ | ? |
| E9 (qmd: marketplace.json mcpServers) | ? | ? | ? | ? | ✓ |
| E10 (commit ac828a4, shell script) | ? | ✓ | ? | ? | ? |
| E11 (original node command, wrapper) | ✓ | ✗ | ? | ? | ✓ |

### First-pass verdict

H1 is the leading root cause with high confidence, corroborated by H5. E5 is the most discriminating row: 0.1.8 had `command: "node"` with args — the correct command form — yet still failed, ruling out H2 as the sole or original cause. The persistent root cause is the `mcpServers` wrapper (H1), present since the initial commit. H5 (missing marketplace.json plugins[0].mcpServers) compounds H1: codeflow is the only plugin with both a marketplace.json AND no mcpServers therein; if CC prefers that path, both failures are active simultaneously. H3 is elevated to medium by the observation that all confirmed-working stdio MCP plugins are globally enabled. H4 is refuted by E8.

## 3. Investigation log

- **Round 1** (gap: check project-level settings vs prior-session assumption):
  - Tools: `Read(codeflow/.claude/settings.local.json)`, `Read(~/.claude/settings.json)`, `Read(scripts/build-plugin.ts)`
  - New evidence: E7 (project-scoped enabledPlugins exists), confirmed prior-session's "missing global enabledPlugins" was wrong
- **Round 2** (gap: understand .mcp.json format across working plugins):
  - Tools: `find(~/.claude/plugins/cache -name ".mcp.json")`, `Bash(cat playwright/.mcp.json)`, `Bash(cat context7/.mcp.json)`, `Bash(cat vercel/.mcp.json)`, `Bash(cat supabase/.mcp.json)`
  - New evidence: E1, E2, E3, E4, E8 (format bifurcation: flat for stdio, wrapper for HTTP)
- **Round 3** (gap: git history of .mcp.json, qmd marketplace.json mcpServers):
  - Tools: `git log -- .mcp.json`, `git show 356ddc5:.mcp.json`, `git show ac828a4:.mcp.json`, `Bash(qmd marketplace.json mcpServers)`
  - New evidence: E5, E6, E9, E10, E11 (wrapper from day 1, qmd uses marketplace.json mcpServers)
- **Stop reason:** converged — H1 has ≥3 independent supporting rows, inconsistency matrix ≤20% `?` on H1, H2 weakened by E5

## 4. Judge pass

### Judge 1 — skeptic
- Fresh verdict: Identified wrapper format as primary issue; independently raised H5 (missing marketplace.json plugins[0].mcpServers as a separate but coexistent defect); elevated H3
- Delta on first-pass: Agrees H1 is real. Raised that H4 was framed as a straw-man (CC reads ONLY marketplace.json) and refuted, but the real alternative (CC prefers marketplace.json when present, finds no mcpServers, never checks .mcp.json) was not considered
- RULERS rubric: H-gen: 3/5, alt: 2/5, evidence: 3/5, completeness: 2/5, stopping: 3/5, safety: 4/5
- Flags: warning — missing H5 (marketplace.json plugins[0] has no mcpServers)
- Final verdict: **accept-with-caveats**

### Judge 2 — evidence-auditor
- Citation audit: No rows fabricated. 7/11 are `partial` (quote truncation, path imprecision). E6 omits `description` field from quoted artifact. E9 path imprecise. No support claims are demonstrably false.
- Confirmed rows: E4, E7, E8, E10
- Weakened rows: E1, E2 (path imprecision), E3 (note field truncated), E5, E6 (description omitted), E9 (mechanism gap), E11 (description elided)
- RULERS rubric: H-gen: 4/5, alt: 3/5, evidence: 3/5, completeness: 3/5, stopping: 4/5, safety: 3/5
- Flags: warning — 7/11 partial rows; E6 most material imprecision
- Final verdict: **accept-with-caveats**

### Judge 3 — safety-evaluator
- Likely fix shape: Remove mcpServers wrapper from .mcp.json; add mcpServers to marketplace.json plugins[0]; verify global or project-scoped enablement is sufficient
- Reversibility: Easy — config-file change, version-controlled
- Adjacent risk: Low — no application logic touched; risk is fix-H1-only leaves H3 or H5 active
- Data loss risk: None
- Causal chain: Partial — E5/E6 → H1 is tight; gap is whether fixing H1 alone is sufficient if H3 is co-active
- Spurious-pass risk: Moderate — if both H1 and H3 are active, fixing only H1 yields no visible improvement; may incorrectly lead user to conclude H1 was wrong
- RULERS rubric: H-gen: 3/5, alt: 3/5, evidence: 3/5, completeness: 3/5, stopping: 3/5, safety: 3/5
- Flags: warning — H3 not verified against global settings.json; all working stdio MCP plugins are globally enabled
- Final verdict: **accept-with-caveats**

### Disagreement
- Fired: no
- Reason: all three judges returned accept-with-caveats; no critical flags; unanimous

## 5. Resolution

- **Canonical verdict:** Plugin cache `.mcp.json` uses `{ "mcpServers": { ... } }` wrapper — CC requires flat `{ "serverName": { ... } }` for stdio plugin MCPs (H1, high confidence). Compounded by missing `mcpServers` in `marketplace.json > plugins[0]` (H5, medium confidence). Project-scoped `enabledPlugins` sufficiency for MCP startup is unverified (H3, medium confidence).
- **Canonical source:** majority-3
- **Causal chain:** E5/E6 (wrapper in .mcp.json) + E9 (qmd works via marketplace.json mcpServers, codeflow has none) → H1+H5 (CC cannot register MCP server via either path) → MCP tools absent from deferred tools list
- **Falsification criterion:** Correct .mcp.json to flat format AND add mcpServers to marketplace.json plugins[0], then observe MCP tools appearing in deferred tools list in a live CC session
- **Open gap:** H3 — whether project-scoped enabledPlugins alone is sufficient for MCP server startup (all working stdio MCPs are globally enabled; no documentation evidence either way)

## 6. References

- Files read: `codeflow/.claude/settings.local.json`, `~/.claude/settings.json`, `scripts/build-plugin.ts`, `playwright/unknown/.mcp.json`, `context7/unknown/.mcp.json`, `vercel/0.40.0/.mcp.json`, `supabase/0.1.5/.mcp.json`, `codeflow/0.1.8/.mcp.json`, `codeflow/0.1.9/.mcp.json`, `qmd/0.1.0/.claude-plugin/marketplace.json`, `playwright/unknown/.claude-plugin/plugin.json`
- Tools invoked: Bash: 12, Read: 5
- Commits examined: `356ddc5`, `ac828a4`, `4d84ff3`
- Session turns referenced: prior session summary (7305727e)
