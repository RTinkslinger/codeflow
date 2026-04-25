# codeflow

Live-updating module dependency graphs for TypeScript and Python codebases, as a Claude Code plugin.

## Install

```
/plugin marketplace add RTinkslinger/codeflow
```

## Usage

```
/flow src/            # Open browser diagram — fast view (~1s, dashed edges)
/flow src/ --verified # Add type-resolved overlay (8–60s, solid edges)
```

## Prerequisites

codeflow ships its own fast extractors (no install needed). For verified mode:

**TypeScript verified extraction:**
```bash
npm install -g @sourcegraph/scip-typescript
```

**Python verified extraction:**
```bash
pip3 install scip-python
```

## Accuracy

| Mode | TypeScript | Python (typed) | Python (dynamic) |
|---|---|---|---|
| Fast (module deps) | ~80–90% | ~80–90% | ~80–90% |
| Verified | ~90% | ~80–90% | ~60–80% |

Dynamic Python (metaclasses, monkey-patching) is inherently harder to resolve. The verified lane shows what's statically provable, not what runs at runtime.

## Linux: file watcher limit

If codeflow stops reacting to saves, run:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

## Diagnostics

```bash
node packages/cli/dist/main.js doctor              # Environment audit
node packages/cli/dist/main.js logs tail            # Live log stream
```

## What's deferred to v1.1 and beyond

D2 renderer, cross-language edges, call-graph diagrams (v2). Go (v3). Swift (v4). Architecture/C4 inference (v3).

## License

MIT. Attribution to `veelenga/claude-mermaid` (MIT) for live-reload preview pattern inspiration.
