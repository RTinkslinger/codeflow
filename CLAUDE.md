---
brain_federation: enabled
---
# codeflow

**What this is:** A Claude Code plugin that renders live-updating flowcharts and dependency graphs of polyglot codebases in a browser, with deterministic extraction (must-be-verifiable accuracy bar) and an SCIP-inspired IR.

**Status:** design-approved, pre-implementation. See `docs/upp/specs/2026-04-23-codeflow-v1-design.md` for the full v1 spec.

**Graduated from:** `~/Claude Projects/Jam Sessions/` on 2026-04-23. Jam Sessions retains research/synthesis/mockup artifacts from the design phase.

---

## How to collaborate here

This is a **published-plugin quality bar** project — on the same tier as the UPP plugin. That shapes every decision.

1. **Read the spec first.** `docs/upp/specs/2026-04-23-codeflow-v1-design.md` is the authoritative design. Before proposing changes, cite the section being changed.
2. **Must-be-verifiable is the product.** Deterministic extraction first; Claude annotates, never invents. Every inferred edge is tagged and visually distinct. No silent truth mutation — ever.
3. **The canonicalizer is the sharpest risk.** "One file on disk → one node in merged graph" is the load-bearing invariant. Any merger-layer change is reviewed against `@codeflow/canonical`'s property-based tests.
4. **UPP-pattern distribution.** Committed `node_modules/` in release branch, repo root = the installable plugin, MCP server via stdio from `${CLAUDE_PLUGIN_ROOT}/packages/cli/dist/cli.js`. No npm publish required.
5. **Ship the invariants that survive the eng-lead pre-mortems.** Every design decision in the spec was pressure-tested. Changes to any of: IR shape, state machine, dual-lane UX (Option E), error envelope, lane-scoped error rule — require re-running the relevant pressure test before accepting.
6. **Respect the v1.1 deferrals.** The spec lists exactly what was cut from v1 with rationale. Don't creep features back in during implementation without explicit re-scoping.

## Architecture at a glance

```
Slash command ──▶ CLI ──▶ Detection ──▶ Extractors ──▶ IR ──▶ Canonicalizer ──▶ Merger ──▶ Renderer ──▶ Preview
                                         │                         │                                    │
                                         ▼                         ▼                                    ▼
                              scip-ts / scip-py /        Symbol.Descriptor            stdio MCP + HTTP/WS
                              depcruise / tree-sitter     (language as a field,        (CC talks stdio;
                                                          NEVER in the id)              browser talks HTTP)
```

Eight packages + `@codeflow/test-utils` (internal) + repo-root = the installable plugin.

| Package | Owns |
|---|---|
| `@codeflow/core` | IR types, schema, Zod, extractor interface, config, pino logger, merger |
| `@codeflow/canonical` | Path canonicalizer, Symbol.Descriptor, dedupe merger, invariant assertion |
| `@codeflow/extractor-{depcruise,treesitter-python,scip-typescript,scip-python}` | One per source tool |
| `@codeflow/renderer-mermaid` | IR → Mermaid via DOT-subset viz block |
| `@codeflow/preview` | HTTP + WS + chokidar file watcher |
| `@codeflow/cli` | The `codeflow` binary; composes all above |

## The two operating modes (non-negotiable)

- **Fast** (default): depcruise + tree-sitter-python. Sub-second reload. Edges `confidence: inferred`, dashed.
- **Verified** (opt-in): scip-typescript + scip-python. 8–60s. Edges `confidence: verified`, solid.

Verified-diff UX is "Option E" (see spec §10): first verified arrival animates; subsequent are silent swaps with badge; preference `require_manual_apply` switches to pending-apply. **Never swap truth silently on first arrival** — the animation moment is load-bearing for the user's mental model.

## What NOT to do here

- Do not invoke implementation skills from this CLAUDE.md's context. Start implementation by invoking **`upp:writing-plans`** explicitly on the spec.
- Do not rewrite the spec during implementation without re-running the relevant eng-lead pressure tests (the sections that were reviewed: 2, 3, 4).
- Do not drop the canonicalizer's `InvariantError` runtime check in favor of "silent dedupe." The spec explicitly requires throw-with-diagnostic-payload.
- Do not ship v1 without the plugin-install smoke test on CI (§14). Most likely release regression is "node_modules didn't commit."
- Do not add upstream-tool error handling to other categories. `upstream` exists as a dedicated error category for a reason (see §12).

## Spec-linked global rules

| Global rule | Applies because |
|---|---|
| Tool Priority (CLAUDE.md root rule) | Use `scip-typescript` binary (CLI) and `scip-python` (CLI) as subprocesses, not via MCP wrappers |
| Documentation Precision | IR schema names are load-bearing; never describe as "the schema" — always cite specific field or package |
| Frontend Design Reckoner (for the preview browser UI) | Already applied in UX mockups; see spec §10 |
| Ecosystem Scan before new patterns | Before adopting any new library (e.g., layout engine like elkjs), check against UPP/sibling projects |

## Research archive (local to this project)

All research + synthesis + UX mockups from the 2026-04-23 design jam are in `docs/research/`. Read `docs/research/README.md` for a guided reading order. Key entry points:

- `docs/research/2026-04-23-cc-flowchart-synthesis.md` — why codeflow is shaped this way (convergence map + three hypotheses + pre-mortem)
- `docs/research/2026-04-23-ir-python-priorart-synthesis.md` — why SCIP, why graphology, why not pyan3/jarviscg/LSIF
- `docs/research/2026-04-23-ux-mockups/index.html` — interactive browser mockups of the four verified-diff UX patterns considered (Option E was selected)

If the spec disagrees with a research file, **the spec wins** — it incorporates later corrections (e.g., the jarviscg archival finding after the python-extractors research was published).

## Next step when a human returns here

Invoke `upp:writing-plans` on `docs/upp/specs/2026-04-23-codeflow-v1-design.md`. That skill produces a task-ordered implementation plan from the spec. **Do not start coding before that plan exists.**
