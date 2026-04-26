# codeflow

Live-updating module dependency graphs for TypeScript and Python codebases, as a Claude Code plugin.

## Install

Open the plugin marketplace in Claude Code and install **codeflow**, or run:

```
/plugin marketplace add RTinkslinger/codeflow
```

Then reload plugins:

```
/reload-plugins
```

## Usage

```
/flow src/            # Fast view — module-level graph, ~1s, dashed edges
/flow src/ --verified # Verified view — type-resolved, 8–60s, solid edges
```

`/flow` opens a browser tab with a live-updating Mermaid diagram. The diagram reloads automatically on file save.

## Prerequisites

Fast mode ships its own extractors — no extra installs needed.

For **verified mode** (higher-accuracy, type-resolved edges):

```bash
# TypeScript
npm install -g @sourcegraph/scip-typescript

# Python
pip3 install scip-python
```

## How it works

| Mode | Extractors | Edge confidence | Typical latency |
|---|---|---|---|
| Fast | depcruise + tree-sitter | inferred (dashed) | ~1s |
| Verified | scip-typescript + scip-python | verified (solid) | 8–60s |

On first `/flow --verified`, the browser shows the fast graph immediately, then overlays the verified graph when it arrives — animated so you can see what changed. Subsequent verified refreshes are silent swaps.

## Accuracy

| Language | Fast | Verified |
|---|---|---|
| TypeScript | ~80–90% | ~90% |
| Python (typed) | ~80–90% | ~80–90% |
| Python (dynamic) | ~80–90% | ~60–80% |

Dynamic Python (metaclasses, monkey-patching) is inherently hard to resolve statically.

## Diagnostics

Run the doctor to check your environment:

```
/flow doctor
```

Or directly:

```bash
node ~/.claude/plugins/cache/codeflow/codeflow/$(ls ~/.claude/plugins/cache/codeflow/codeflow/)/packages/cli/dist/main.js doctor
```

## Linux: file watcher limit

If codeflow stops reacting to saves:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

## What's coming

- D2 renderer, cross-language edges, call-graph diagrams (v1.1)
- Go, Swift support (v2+)

## License

MIT. Live-reload preview pattern inspired by `veelenga/claude-mermaid` (MIT).
