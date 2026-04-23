# Research archive — codeflow v1 design phase

All artifacts from the 2026-04-23 jam session that produced the v1 spec. Organized here for portability (the project is self-contained; does not depend on the original `Jam Sessions/` folder).

## Reading order

If you want to understand **why codeflow is shaped the way it is**, read in this order:

1. **`2026-04-23-cc-flowchart-diagramming.md`** — initial research (ultra-fast Parallel deep research). The question space: how to give Claude Code flowchart capability in the terminal. Covers existing tools, rendering engines, code-analysis patterns, CC integration approaches.

2. **`2026-04-23-cc-flowchart-synthesis.md`** — first-layer synthesis of the research. Convergence map, three competing hypotheses, pre-mortem, integrated recommendation. Includes §8 "Open-question investigation" where direct GitHub API queries verified CC plugin install flow, CC #2266/#14375 status, and the "jarviscg is archived with no LICENSE" finding that killed that option.

3. **Three parallel deep-research runs**, all ultra-fast:
   - **`2026-04-23-research-graph-libs.md`** — TypeScript graph libraries comparison. Recommends graphology.
   - **`2026-04-23-research-python-extractors.md`** — Python code-graph extractors (pyan3, scip-python, pycg, jarviscg, tree-sitter, LSPs). Originally recommended jarviscg; due-diligence overturned this (see synthesis).
   - **`2026-04-23-research-prior-art-irs.md`** — Data models for code intelligence (SCIP, LSIF, LSP, Kythe, tree-sitter-stack-graphs, Graphviz DOT, srcML, GitHub Semantic). Recommends SCIP as IR core.

4. **`2026-04-23-ir-python-priorart-synthesis.md`** — FULL-mode synthesis of the three research runs above + prior eng-lead review. This is where the IR shape + graphology decision + "jarviscg is out, scip-python is primary" became final. Includes the corrected §7.1 "jarviscg resolved" note after direct gh API verification.

5. **`2026-04-23-ux-mockups/index.html`** — interactive browser mockups of the four verified-diff UX patterns (A badge+panel, B animated, C pending-apply, D hybrid). Opened in browser during the jam to make the UX selection; **Option E** (B-default + C-on-demand with smart-animation rule) was selected after reviewing these.

## The `.json` files

Each ultra-fast research run wrote two artifacts: a markdown report (what to read) and a JSON metadata file (what powered the report). The JSON contains:
- `basis[]` — per-field reasoning with citation arrays
- Full excerpt text from each cited URL
- Confidence ratings per claim

Useful if you want to verify a specific claim in the markdown against its source. Not needed for implementation.

## How this was produced

Using Parallel CLI (`parallel-cli research run --processor ultra-fast`) for all three parallel research runs, then the `research-synthesis` skill for the FULL-mode synthesis with phases: evidence extraction → convergence map → three hypotheses → stress-test pre-mortem → integrated recommendation → spec doc → validator subagent. Adversarial reviewer subagents pressure-tested Sections 2, 3, and 4 of the spec across four review cycles.

## What graduated out of this phase

The design consolidated into `../upp/specs/2026-04-23-codeflow-v1-design.md`. That spec cites findings here but is the authoritative source going forward. If the spec and a research file disagree, **the spec wins** — it incorporates later corrections.
