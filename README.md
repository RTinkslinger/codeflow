# codeflow

**Live-updating module dependency graphs for TypeScript and Python codebases, directly in your browser — as a Claude Code plugin.**

Type `/flow src/` in Claude Code. A browser tab opens showing a live Mermaid diagram of your codebase's module structure. Save any file and the diagram updates in under a second. No config, no build step, no separate tool to run.

---

## Install

```
/plugin marketplace add RTinkslinger/codeflow
```

Then reload plugins:

```
/reload-plugins
```

That's it. The `/flow` command is immediately available.

---

## Quick Start

```bash
/flow src/             # Open live browser diagram — fast view, ~1s
/flow src/ --verified  # Add type-resolved overlay, 8–60s
/flow .                # Analyse the whole project from cwd
```

---

## Two extraction modes

codeflow runs two extraction lanes, selectable per invocation:

### Fast mode (default)

Uses **depcruise** (TypeScript/JavaScript module graph) and **tree-sitter** (Python AST). Produces a diagram in under a second. Edges are marked as `inferred` and drawn dashed — honest about what's statically derivable at speed.

No extra installs required. Both extractors ship inside the plugin.

### Verified mode (`--verified`)

Uses **scip-typescript** and **scip-python** — the same SCIP-based extractors that power Sourcegraph's code intelligence. Produces type-resolved edges (e.g. interface implementations, cross-module type flows) that depcruise can't see. Edges are marked `verified` and drawn solid.

On first `/flow --verified`, the browser shows the fast graph immediately. When the verified graph arrives (8–60s), it animates in — so you can see exactly what changed between inferred and verified. Subsequent verified refreshes swap silently.

**Prerequisites for verified mode:**

```bash
# TypeScript (includes the scip binary)
npm install -g @sourcegraph/scip-typescript

# Python
pip3 install scip-python
```

---

## How the browser diagram works

- Opens at `http://127.0.0.1:<port>` automatically on `/flow`
- Updates live via WebSocket — no manual refresh
- Dashed edges = inferred (fast lane); solid edges = verified
- Badge in top-left shows current view state: `● fast view`, `● verified`, `● fast view (verified failed)`
- The diagram stays open and continues updating as you edit files
- Multiple previews can run simultaneously (cap: 8)

---

## Accuracy

| Language | Fast mode | Verified mode |
|---|---|---|
| TypeScript | ~80–90% | ~90% |
| Python (typed annotations) | ~80–90% | ~80–90% |
| Python (dynamic) | ~80–90% | ~60–80% |

Dynamic Python patterns — metaclasses, monkey-patching, `__import__` — are inherently hard to resolve statically. The verified lane shows what's provable, not what runs at runtime.

---

## MCP tools

codeflow exposes 5 MCP tools that Claude Code can call directly during analysis sessions:

| Tool | Description |
|---|---|
| `start_preview` | Start a live preview for a path, returns URL + previewId |
| `stop_preview` | Stop a running preview and free its port |
| `list_previews` | List all active previews with status and last-seen timestamps |
| `get_ir` | Fetch the current IR (intermediate representation) as structured JSON |
| `render_once` | One-shot render to a `.mmd` file — no browser, no server |

These are what the `/flow` skill calls under the hood. You can call them directly for scripted or agentic workflows.

---

## Diagnostics

Run the built-in doctor from the CLI:

```bash
node ~/.claude/plugins/cache/codeflow/codeflow/0.1.9/packages/cli/dist/main.js doctor
```

Checks Node.js version, OS, and whether each extractor binary is available (`depcruise`, `scip-typescript`, `scip-python`, `scip`). Reports recent errors from the local diagnostics store. Output is JSON.

---

## Architecture

```
/flow command
     │
     ▼
CodeflowMCP (packages/cli)
     │
     ├── Fast lane:     DepcruiseExtractor + TreeSitterPythonExtractor
     │                  → IR merge → canonicalize → Mermaid → broadcast
     │
     └── Verified lane: ScipTypescriptExtractor + ScipPythonExtractor
                        → IR merge → canonicalize → diff vs fast → broadcast
                                                              │
                        PreviewServer (HTTP + WebSocket) ◄────┘
                        FileWatcher (chokidar) → re-run on save
```

**IR (Intermediate Representation):** A language-agnostic JSON structure with `symbols` (modules/functions/classes) and `relationships` (imports, calls). Each symbol gets a `Symbol.Descriptor` ID — a scheme that encodes language, package, and path without baking language into the ID itself. The canonicalizer deduplicates symbols across extractors so the same file on disk always produces one node in the merged graph.

---

## Linux: file watcher limit

If codeflow stops reacting to saves:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

---

## What's coming

- **v1.1:** Cross-language edges, call-graph diagrams, D2 renderer option
- **v2+:** Go support, Swift support, architecture/C4 inference

---

## License

MIT. Live-reload preview pattern inspired by [`veelenga/claude-mermaid`](https://github.com/veelenga/claude-mermaid) (MIT).
