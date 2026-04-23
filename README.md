# codeflow

Live-updating flowcharts of polyglot codebases, in the browser, from Claude Code.

Type `/flow module-deps src/` in CC → see a live-reloading Mermaid diagram of your codebase's module structure in a browser tab. Save a file → diagram updates sub-second.

## Status

**Design phase complete.** Full v1 spec at `docs/upp/specs/2026-04-23-codeflow-v1-design.md`. Implementation not started.

## Design highlights

- **Must-be-verifiable**: deterministic extraction (depcruise, scip-typescript, scip-python, tree-sitter-python). Claude annotates. Never invents.
- **SCIP-inspired IR**: language-agnostic `Symbol.Descriptor` IDs. Graphology in-memory. Versioned JSON wire format.
- **Two modes**: fast (sub-second, inferred edges) + verified (type-resolved, 8–60s). Single preview serves both.
- **Polyglot v1**: TypeScript + Python merged into one graph. Go v3. Swift v4.
- **UPP-pattern distribution**: install via `/plugin marketplace add`. No npm install needed on user machine.

## What ships in v1

- TS + Python, module dependency graphs, merged-cross-language view
- Fast + verified extraction modes with Option E verified-diff UX
- Browser live-reload preview (CC doesn't support inline images; browser is the display surface)
- 5 MCP tools: `start_preview`, `list_previews`, `stop_preview`, `render_once`, `get_ir`
- Monorepo workspace detection
- `codeflow doctor` CLI for environment audit + bug-report bundling

## What's deferred to v1.1 and beyond

See spec §2. Highlights: D2 renderer (v2), cross-language edges (v2), call-graph diagrams (v2), Go (v3), Swift (v4), architecture/C4 inference (v3).

## Starting implementation

1. Read `CLAUDE.md` in this directory.
2. Read the full spec at `docs/upp/specs/2026-04-23-codeflow-v1-design.md`.
3. Invoke the `upp:writing-plans` skill on the spec. That produces an implementation plan.
4. Do not start coding before the plan exists.

## License

TBD (MIT planned). Attribution to `veelenga/claude-mermaid` (MIT) for live-reload preview pattern inspiration.
