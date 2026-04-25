---
description: Open a live-updating module dependency graph in your browser
allowed-tools: mcp__codeflow__start_preview, mcp__codeflow__get_ir, mcp__codeflow__list_previews, mcp__codeflow__stop_preview, mcp__codeflow__render_once
---

Open a live browser diagram of the module dependency graph for the given path.

Usage: /flow [path] [--verified]

Arguments:
- path: Directory to analyze (defaults to current working directory)
- --verified: Use type-resolved extractors (slower but more accurate)

Steps:
1. Call mcp__codeflow__start_preview with { path: <resolved path> } (add verified: true if --verified was passed)
2. Relay the returned URL to the user: "Opening codeflow at <url> — the diagram will appear in your browser in a moment."
3. The browser will auto-update as extraction completes. Fast view appears in ~1s with dashed edges. If --verified was passed, verified view follows in 8–60s with solid edges.

If start_preview returns an error, check mcp__codeflow__list_previews for the preview cap. If 8 previews are running, call mcp__codeflow__stop_preview on one before retrying.
