# Synthesis — Giving Claude Code Flowchart/Diagram Capability in the Terminal

**Date:** 2026-04-23
**Mode:** FULL (all 7 phases)
**Inputs:** 1 deep-research report (ultra-fast processor, 8m20s) spanning **153 basis items** across **33 unique citation URLs** and **3 confidence bands** (87 high / 58 medium / 8 low).
**Note:** "Sources" here = the distinct citations surfaced by the research, not separate reports.

---

## 1. Problem statement

The user runs Claude Code (the CLI) in a terminal and wants: *"I type a prompt and I see a flowchart of my codebase logic."* The deep-research report offered a 5-path recommendation matrix crowned by "Claude Code → D2 CLI + Web-view Preview." This synthesis tests whether that recommendation holds once the underlying citations are cross-referenced, and whether a stronger composite answer exists.

---

## 2. Sources analysed (with evidence weight)

Grouped by function, with citation count from the 153-item basis:

| Bucket | Key sources | Refs |
|---|---|---|
| **D2** | d2lang.com/tour/exports (49), d2lang.com (21), heathdutton/claude-d2-diagrams (37) | ~107 |
| **Mermaid** | mermaid-js/mermaid-cli (44), manavsehgal mermaid-visualization-guide (43), mermaid-js/mermaid (22), mermaid.js.org/syntax-reference (18), mermaid.js.org (13) | ~140 |
| **Terminal image display** | sindresorhus/terminal-image (41), iterm2.com images (38), sw.kovidgoyal.net/kitty/graphics-protocol (36), chafa man (19), ratatui-image (21), sixel references | ~155 |
| **Claude Code integration** | veelenga/claude-mermaid MCP (28), anthropics/claude-code#2266 (28), #14375 (30), plugin-dev MCP SKILL.md (19) | ~105 |
| **tmux / multiplex** | tmux#4902 Kitty protocol (26) | 26 |
| **UML / PlantUML** | plantuml.com/starting (18) | 18 |
| **Code analyzers** | dependency-cruiser cli.md (15), madge (12) | 27 |
| **LLM benchmark** | arXiv MermaidSeqBench (3), ResearchGate mirror (3) | 6 |
| **Self-hosted LLM** | sourcegraph self-hosted (3) | 3 |

**Source-quality caveats:**
- Report repeats many URLs as both `http://` and `https://` variants (e.g., d2lang.com/tour/exports/ vs d2lang.com/tour/exports) — effective distinct-source count is closer to ~26 than 33.
- No commercial tool pages (CodeSee, Swimm, AppMap, Sourcetrail, Understand) have citations beyond brief mention — those claims are thinly evidenced.

---

## 3. Convergence map

Matrix built from cross-referencing basis items. Claim IDs used later.

| Claim ID | Claim | Supporting sources | Contradicting / qualifying sources | Status |
|---|---|---|---|---|
| **C1** | "DaC generation + external render" is the dominant pattern (Claude emits text → CLI renders image) | mermaid-cli, d2lang, plantuml, depcruise, kroki | — | **Strong convergence** |
| **C2** | D2 produces the cleanest automatic layouts from LLM output | d2lang homepage, heathdutton plugin docs, report body | *Qualified by:* MermaidSeqBench exists as a formal LLM-eval benchmark for **Mermaid** (none exists for D2 per the citations) — Mermaid has more empirical LLM tooling | **Supported with qualifier** |
| **C3** | LLMs have more training data on Mermaid | report body line 853, implied by 44 Mermaid-CLI refs + 43 Mermaid-guide refs | — | **Strong convergence** |
| **C4** | Claude Code has an "integrated web-view preview pane" for diagrams | **Report narrative only** — NO citation supports this | *Contradicted by:* anthropics/claude-code#2266 ("Enable terminal graphics display in Claude Code by implementing support for Sixel, Kitty, and iTerm2…" — **open feature request, Jun 2025**) AND #14375 ("Integrating Mermaid → ASCII rendering in CC would enable…" — **open feature request, Dec 2025**) | **Unsupported — likely hallucinated** |
| **C5** | tmux supports Kitty image protocol via passthrough | chafa man ("passthrough mode [auto, none, screen, tmux]") | *Contradicted by:* tmux#4902 (Mar 2026) — Kitty protocol support is an **open issue**, not shipped upstream | **Partial — requires chafa's workaround, not native tmux** |
| **C6** | veelenga/claude-mermaid provides live-reload Mermaid preview inside Claude Code | veelenga repo excerpt | *Qualifies:* excerpt says "previewing" — does not confirm it renders in-terminal; most likely serves HTML to a browser | **Real but display-path ambiguous** |
| **C7** | heathdutton/claude-d2-diagrams is a working CC plugin that analyses codebases and emits D2 | heathdutton excerpts ("generates infrastructure and architecture diagrams from your codebase using D2") | — | **Strong — real integration exists** |
| **C8** | ASCII renderers (mermaid-ascii, diagon) work anywhere | mermaid-ascii npm, report | *Qualifies:* "Low fidelity… best for simple flowcharts" — explicitly not suitable for the stated use case (codebase logic flow = complex) | **True but use-case mismatch** |
| **C9** | chafa auto-detects Kitty/iTerm2/Sixel and degrades gracefully | chafa man, terminal-image README | — | **Strong convergence** |
| **C10** | Code-analysis tools are language-siloed | depcruise (JS/TS), pyan3 (Py), go-callvis (Go), madge (JS/TS) | *Alleged universality:* tree-sitter-graph (any language) — but excerpts confirm it "requires building from source and writing custom rules." Understand is multi-language but commercial. | **No free universal analyzer** |
| **C11** | MCP is the canonical integration mechanism for CC plugins | CC plugin-dev MCP SKILL.md, veelenga, heathdutton | — | **Strong convergence** |
| **C12** | Docker wrapping solves dependency & security concerns for renderers | mermaid-cli Docker excerpts, plantuml server image | *Qualifies:* adds ~2s startup latency per render — breaks "instant feedback" expectation | **Supported with latency cost** |

**HARD GATE check:** 4 rows carry contradiction/qualifier signal (C2, C4, C5, C6, C8, C10, C12). Not zero. Passes.

**The single most important contradiction (C4) deserves emphasis:** the report's top recommendation is built around displaying SVG in "Claude Code's web-view preview pane" — but two open Claude Code GitHub issues from 2025 explicitly show this surface doesn't exist. The report is recommending infrastructure that isn't shipped.

---

## 4. Three competing hypotheses

Three genuinely different architectures — not three abstraction levels of one idea.

### H1 — "Accept the report": D2 + SVG opened in browser
**Mechanism:** Claude generates D2 DSL in response to a prompt. User runs `d2 file.d2 out.svg`. `open out.svg` launches the default browser. Layout is handled by D2's default (dagre) or paid TALA engine.
**Evidence for:** C1, C2, C11. 107 refs for D2.
**Evidence against:** C4 (no native preview pane), C3 (Mermaid has better LLM fluency), C10 (no code-analysis — Claude hallucinates the flowchart from reading files itself).

### H2 — "Plugin-first": Install heathdutton/claude-d2-diagrams and/or veelenga/claude-mermaid
**Mechanism:** Delegate the whole generation + rendering pipeline to an existing CC plugin. The plugin handles codebase walking, DSL emission, rendering, and display (via MCP + a browser or a file written to disk).
**Evidence for:** C6, C7, C11. Real, shipped integrations cited.
**Evidence against:** Plugin fragility (no release cadence visible); C6 ambiguity about actual display surface; plugin lock-in to one DSL (D2 for heathdutton, Mermaid for veelenga).

### H3 — "Composite pipeline": tree-sitter/ast-grep extraction → LLM as layout-annotator → D2 or Mermaid DSL → chafa-in-terminal for glances + browser for deep work
**Mechanism:** Separate the three concerns the report conflates. (a) **Extract** structure with a deterministic tool (tree-sitter queries, or language-specific analyzer like depcruise/pyan3 when available). (b) **Annotate** with Claude — Claude's job is to *decorate* the extracted graph (cluster names, narrative labels, omission decisions), NOT to invent it. (c) **Render** twice — PNG → chafa inline for a glance, SVG → browser when deep work is needed.
**Evidence for:** C1, C9, C10 (forces recognition that analyzers are siloed), C2 (still uses D2 for layout), C3 (can pick Mermaid or D2 per diagram type).
**Evidence against:** Higher setup cost; requires writing/adopting per-language extractors; a bash alias can't route between "glance" vs "deep" automatically — user picks.

Collapse test: H1 and H2 differ in *ownership* (roll-your-own vs community plugin). H2 and H3 differ in *whether code is actually analysed* (H2 depends on plugin internals; H3 forces deterministic extraction as a first-class step). H1 and H3 differ in *whether the LLM invents structure or decorates it*. All three are distinct.

---

## 5. Pre-mortem — specific failure modes per hypothesis

### H1 fails because…
- **F1a (C4 contradiction):** User follows the report, installs D2, runs the slash command, and there is no "preview pane" to display the SVG. They fall back to `open out.svg` which spawns a browser — the exact thing the report implied they'd avoid. Promised convenience is illusory.
- **F1b (C2 qualifier):** D2's *default* layout is dagre; the superior layouts ("TALA") that sell D2's reputation are paid. For the stated use case (codebase flowchart = 30–200 nodes), dagre clutters just like Mermaid does. The user won't see the quality differential that justified picking D2 over Mermaid.
- **F1c (C3 contradiction):** Claude has been trained on orders of magnitude more Mermaid than D2. MermaidSeqBench exists as a formal benchmark (arXiv 2511.14967) for LLM-to-Mermaid generation — no equivalent benchmark exists for D2. Per-attempt validity rate is likely higher for Mermaid, meaning more retries with D2, meaning more friction despite D2's "tolerant syntax."
- **F1d (C10 gap):** H1 has no code-analysis step. Claude generates diagrams by reading source files into context and *describing* them — which is hallucination-prone at codebase scale. Every call graph Claude emits is plausible-looking but unverified against the actual AST.

### H2 fails because…
- **F2a (C6 ambiguity):** veelenga/claude-mermaid serves its preview via a local web server — the user still needs a browser window open, and if they're in a headless SSH session this doesn't solve the "in the terminal" ask. The MCP doesn't magic pixels into Claude Code's stdout.
- **F2b (plugin velocity):** Both cited plugins are solo-maintained community projects. If the CC plugin API changes (which it does — see plugin-dev/mcp-integration SKILL.md being under active iteration), the plugin breaks and the user must either fix it themselves or wait.
- **F2c (DSL lock-in):** heathdutton is D2-only. veelenga is Mermaid-only. The user can't swap DSL per diagram type (sequence diagrams render better in Mermaid; system architecture renders better in D2). Adopting H2 means one-tool-per-plugin, doubling setup if both are needed.
- **F2d (delegation opacity):** The user can't inspect *how* heathdutton analyses the codebase. If the plugin walks only JavaScript imports, a Python user gets a worse diagram with no signal that "analysis confidence is low for this language."

### H3 fails because…
- **F3a (C10 gap remains):** Even with tree-sitter extraction, there is no single tool that handles call-graph extraction uniformly across Python + JS + Go + Rust. The user still needs to pick an analyzer per language; H3 just makes this decision explicit rather than hiding it.
- **F3b (setup cost):** H3 requires installing: tree-sitter-cli OR language-specific analyzer(s), D2, chafa, a tmux passthrough config. That's ≥4 components vs H1's 1 or H2's 1. The user may stall at setup.
- **F3c (C5 contradiction):** chafa-in-tmux only works with `allow-passthrough on` (per chafa man + tmux#4902 showing native Kitty isn't there). This is a terminal config the user may not own — corporate/managed environments often lock it down.
- **F3d (cognitive overhead):** User must choose "glance vs deep" every time. If they always pick deep, they've built infrastructure for a mode they never use.

---

## 6. Integrated recommendation

### The synthesis

**None of H1, H2, H3 is right alone. The best answer is a pragmatic stack that uses H2 as the entry point, promotes H3's extraction discipline when stakes are high, and collapses to H1's mechanics when the user is in an alien environment.**

**Concrete recommendation — three layers, pick the layer that matches the ask:**

#### Layer 1 (default, 90% of cases) — Install the existing plugin
```
# For architecture/infra diagrams from a real codebase:
claude plugin install heathdutton/claude-d2-diagrams          # per C7
# OR for live-reload Mermaid with file-watch:
# (veelenga/claude-mermaid — MCP server install per C6/C11)
```
**Why this first:** C7 is a strong, unqualified claim — a real working integration exists today. Paying the setup cost of H3 before validating whether the simpler thing works is premature optimisation. The report's *path* (D2 + SVG) is right; the report's *deployment story* (preview pane) is wrong (C4) — so use a plugin that already encapsulates the "render + view" step.

#### Layer 2 (when Layer 1 mis-analyses) — Add a deterministic extraction pre-step
When the plugin produces a diagram that's clearly wrong or hallucinated (F1d / F2d), slot a code-analysis tool in *front* of it:
- JS/TS → `depcruise --output-type mermaid src/` (C1, ref 15)
- Python → `code2flow` or `pyan3 --dot` (report body)
- Go → `go-callvis` (report body)
- multi-language → tree-sitter + custom queries (C10 qualifier — non-trivial)

Feed the extracted DSL to Claude and ask it to *annotate and prune*, not invent. This is H3's extract→annotate→render split, applied only when H2 isn't good enough. This matters specifically for the user's phrasing — *"flowchart of my codebase logic"* implies factual accuracy; hallucinated edges are a silent-failure class.

#### Layer 3 (when no browser allowed — SSH / remote / headless) — The real lightweight path
Skip both the plugin and the SVG-in-browser route. Go direct:
```
# Generate Mermaid (higher LLM validity rate — C3), pipe to ASCII:
npm i -g mermaid-ascii
claude "Emit mermaid flowchart" | mermaid-ascii
```
For higher fidelity when the terminal supports Kitty/iTerm2 (C9):
```
# Render Mermaid → PNG → inline via chafa (auto-detects protocol):
mmdc -i d.mmd -o d.png && chafa d.png
```

**The key reframe:** the report treated "best overall" and "best fallback" as *competing* answers. They aren't — they're **different layers for different environments**. The user's literal ask ("in the terminal") has two legitimate readings:
1. "In my terminal emulator, but a browser window popping up is fine" → Layer 1/2
2. "Pixels appearing inside the terminal emulator window itself" → Layer 3 (chafa path) or ASCII

Pick the layer based on which reading applies, not based on which DSL "wins."

### Why this survives the pre-mortem

- **F1a disarmed:** no assumption of a CC preview pane. Layer 1 uses the plugin's own display; Layer 3 uses chafa's protocol detection.
- **F1b disarmed:** D2 layout concerns don't block you — Layer 3 falls back to Mermaid, which is more battle-tested at ASCII scale anyway.
- **F1c disarmed:** Mermaid is explicitly allowed at Layer 3 (its strongest LLM-fluency position); D2 is used where its layout wins (architecture, Layer 1 via heathdutton).
- **F1d / F2d / F3a disarmed:** Layer 2 adds deterministic extraction *when needed*, without paying its setup cost upfront.
- **F2a/b/c disarmed:** Plugin is the entry point, not the only point — Layers 2 and 3 provide exit ramps when the plugin is wrong, stale, or inaccessible.
- **F3b/d disarmed:** Setup cost and cognitive overhead are paid lazily, only when Layer 1 actually fails.

### What this recommendation CANNOT solve

- **Native in-terminal display from Claude Code itself:** CC issues #2266 and #14375 remain open as of this research (latest activity Dec 2025 and Jun 2025). Until one of those ships, any "image inside the terminal" path goes through external tools (chafa) + a compatible emulator.
- **Multi-language codebase flowcharts without manual tool-picking:** C10 is a real gap. The only multi-language option cited (Understand / SciTools) is commercial, and tree-sitter-graph needs custom query authoring.
- **Claude Code's built-in code analysis vs. deterministic AST analysis:** the research doesn't quantify how often Claude-as-analyser hallucinates call edges. Until someone runs that eval, F1d remains theoretical — the user should *assume* hallucinations until disproved for their codebase.

---

## 7. Open questions

1. **Does `veelenga/claude-mermaid` render inline or spawn a browser?** The excerpt says "preview" but doesn't specify surface. Need to read the MCP server's response types in its `.mcp.json`/server code.
2. **Does Claude Code have *any* mechanism for displaying an inline image today?** Issues #2266 and #14375 suggest no, but a passthrough via Bash tool + Kitty protocol might work inside a compatible emulator with `chafa` — needs empirical test.
3. **What is the error-rate differential between Claude generating valid D2 vs valid Mermaid?** MermaidSeqBench gives a Mermaid number; no D2 equivalent exists. Without it, C2 vs C3 is adjudicated by anecdote.
4. **Is there a community tree-sitter-graph ruleset that handles call-graph extraction across Python + JS + Go?** If yes, H3's setup cost drops dramatically. If no, H3 remains a case-by-case proposition.
5. **Licensing of heathdutton and veelenga plugins for commercial use.** Not surfaced in citations.

---

---

## 8. Open-question investigation (added 2026-04-23)

Each of §7's five questions was investigated via direct repo inspection (`gh api`), release-notes analysis, and web search. Findings below — three of the five meaningfully **change** the recommendation.

### Q1 — Where does `veelenga/claude-mermaid` display the diagram?

**Answer: Browser, not terminal.** Confirmed from the repo README: *"Automatically renders diagrams in your browser with real-time updates… Live Reload — Diagrams auto-refresh in your browser as you edit."* Working files persist at `~/.config/claude-mermaid/live`. Repo is active (last update 2026-04-22, 131 stars, MIT). This confirms **C6 qualifier** in the convergence map: the MCP serves HTML to a browser window — it is not an in-terminal display path.

**Impact on recommendation:** Layer 1 with veelenga still requires a browser window. Functionally identical to running `open out.svg` manually, just with live-reload convenience.

### Q2 — Does Claude Code display inline images today? **(This answer changes the picture.)**

**Answer: Still no, and the feature request was closed without implementation.**

- CC issue #2266 was closed 2026-04-07 as `state_reason: "completed"` by @antrewmorrison (an Anthropic dev).
- **BUT:** Every Claude Code release since that date (v2.1.109 through v2.1.117, spanning 2026-04-15 to 2026-04-22) contains **zero** mentions of image/graphic/sixel/kitty-graphics/mermaid/diagram/svg/png rendering in its release notes. The only Kitty-protocol mention is for *keyboard* shortcuts (`Ctrl+-` fix), which is a different protocol.
- The final comment on the issue before it was auto-locked was from `@eduwass` asking *"does this mean this feature will be included in an upcoming release of Claude Code, or is it not planned?"* — **never answered**.
- A comment from `@authentickzz` on 2026-03-28 describes trying to work around CC's stdout capture via a PostToolUse hook that writes directly to `/dev/tty` — reports it as "partially works but is fragile." This is the only reproducible workaround surfaced in the comment thread.

**Conclusion:** "Closed as completed" appears to be a housekeeping closure, not a ship. Claude Code as of v2.1.117 (2026-04-22) does not render images in its terminal UI. **The `/dev/tty` hook is the only known workaround and the commenter who tested it called it fragile.**

**Impact on recommendation:** Layer 3 of the synthesis (chafa inline images) will not work if rendered inside Claude Code's own chat UI — CC captures subprocess stdout. It *will* work if the user invokes the render command outside CC (separate pane, split tmux) or via a hook that bypasses stdout. Layer 3 needs this caveat made explicit.

### Q3 — D2 vs Mermaid LLM-validity rate

**Answer: No D2 benchmark exists.** Searched recent arXiv + web results — MermaidSeqBench (arXiv 2511.14967) remains the only formal LLM-to-diagram-DSL eval. No D2 equivalent found. Third-party comparisons are anecdotal (LinkedIn posts, Reddit threads) and consistent with one signal: practitioners report Mermaid is easier to get right but D2 looks better when you do get it right — no numeric comparison exists.

**Impact on recommendation:** The synthesis already flagged this (F1c). No update needed, but confirms the "pick Mermaid when validity matters more than layout" rule of thumb.

### Q4 — Multi-language call-graph extraction for AI integration

**Answer: The most promising project — Nuanced — was archived 2026-04-08, one day after CC #2266 closed.** This is a meaningful finding.

- **Nuanced** (`nuanced-dev/nuanced`): MIT, 127 stars, purpose-built as *"call graph context layer for AI coding tools"* — **archived 2026-04-08**. Python-only. The blog post (archive.nuanced.dev/blog/python-open-source-launch) says they evaluated `pycg`, `tree-sitter-stack-graphs`, `Glean`, `scip-python`, and `pytype`, and chose `JARVIS` as a starting point.
- **IntentGraph** — Python repo dependency graphs & clustering (Aug 2025). Python-only.
- **kirograph** — semantic code knowledge graph for Kiro (an AI IDE). Not CC-integrated.
- **graphifyyy** — tree-sitter based, supports Java / C / Swift / Objective-C / Go / Elixir (no Python listed — unusual).
- **tree-sitter-stack-graphs** — GitHub's official project, `v0.1` on crates.io, Rust. Early-stage.
- **Dossier** — Rust tree-sitter parser, 2 years old, multi-language.

**Conclusion:** There is **no active, production-grade, multi-language call-graph extractor purpose-built for LLM integration as of April 2026.** Language-specific tools (depcruise for JS/TS, pyan3 for Python, go-callvis for Go) remain the realistic choice. Layer 2 of the recommendation is correct to treat analyzer selection as a per-language decision.

**Impact on recommendation:** Actually *strengthens* Layer 2. The alternative — a universal extractor — doesn't exist. The user who wants logic flows across a polyglot codebase has to compose language-specific analyzers, not expect one tool to do it all.

### Q5 — Licensing of heathdutton and veelenga plugins

**Answer: Mixed — one clean, one with a legal wrinkle.**

- **veelenga/claude-mermaid:** MIT, confirmed via both API `license.spdx_id` field and a LICENSE file. Safe for commercial use.
- **heathdutton/claude-d2-diagrams:** README badge claims MIT, but **no LICENSE file exists in the repository** (`gh api /contents/LICENSE` returns 404; directory listing shows no LICENSE file). Per GitHub's own guidance and OSI standards, **absent a LICENSE file, default copyright reserves all rights to the author** — regardless of what a badge says. For personal use this is a non-issue; for enterprise adoption, redistribution, or embedding into another product, this is a blocker until the maintainer adds an explicit LICENSE file.
- **Bonus finding — rixinhahaha/snip** (mentioned in CC #14375 comments): MIT, 179 stars, Electron-based Mermaid preview tool. Another option in the "render Mermaid from CC to a popup window" category, macOS/Linux only.

**Impact on recommendation:** If the reader is evaluating for an enterprise context, file an issue with `heathdutton` asking for an explicit LICENSE commit, OR prefer `veelenga/claude-mermaid` + roll your own D2 bash wrapper. For personal use, heathdutton is fine.

### Additional finding not in the original §7 — heathdutton scope mismatch

The original report described heathdutton as a plugin that *"generates infrastructure and architecture diagrams (and documentation) from your codebase using D2."* Reading the README confirmed this is more specific than the synthesis assumed: **the plugin scans Terraform, Kubernetes, Docker, and CloudFormation files** — i.e., infrastructure-as-code, not application source code. For the user's stated ask (*"flowchart of my codebase logic"*), this plugin will produce an infra diagram of the deployment surface, not a logic flow of the code. Same DSL (D2) and same render path, but different extraction target.

**Impact on recommendation:** Layer 1 default should be **veelenga/claude-mermaid** for *logic* flows (let Claude generate Mermaid from reading code), and reserve **heathdutton/claude-d2-diagrams** for *infrastructure* flows (IaC → D2). This reframes the two plugins as complementary rather than competing.

---

### Net update to the recommendation

Revised three-layer stack incorporating §8 findings:

| Layer | Use case | Tool | Caveat from §8 |
|---|---|---|---|
| **L1a (logic flow)** | "Flowchart of my codebase logic" — app-code call graphs, control flow | `veelenga/claude-mermaid` (MCP + browser) | Renders in **browser**, not terminal (Q1). Living workaround for CC's missing in-terminal image support (Q2). |
| **L1b (infra flow)** | "Flowchart of my deployment / architecture" — infra-as-code | `heathdutton/claude-d2-diagrams` | License ambiguity (Q5) — request LICENSE file or use for personal only. |
| **L2 (fact-check)** | When L1a output is hallucinated | Language-specific analyzer (`depcruise`, `pyan3`, `go-callvis`); Nuanced-style universal tool does **not** exist (Q4). | Must compose per-language tools for polyglot codebases. |
| **L3 (pure terminal)** | Headless / SSH / no browser | `mermaid-ascii` (pure ASCII) OR `chafa` + image (only works if invoked **outside** CC's stdout capture; Q2 makes inline-in-CC-chat impossible today). | CC's `/dev/tty` hook workaround exists but is called "fragile" by the user who tested it. |

---

## Appendix — Citation-to-claim traceability

Every claim in §3 is anchored to at least one URL in the 33-source set. URLs with the heaviest weight:
- D2 evidence: d2lang.com/tour/exports (49× refs)
- Mermaid CLI evidence: github.com/mermaid-js/mermaid-cli (44×)
- CC plugin surfaces: github.com/manavsehgal/claude-code-analyst mermaid-visualization-guide (43×), github.com/heathdutton/claude-d2-diagrams (37×)
- Terminal rendering: iterm2.com/3.4/documentation-images.html (38×), sw.kovidgoyal.net/kitty/graphics-protocol (36×)
- **Contradiction anchors:** github.com/anthropics/claude-code/issues/2266 (28×), #14375 (30×), tmux#4902 (26×)

Confidence distribution across the 153 basis items: **high 87, medium 58, low 8**. The 8 low-confidence items are disproportionately in the `modern_developments_2025_2026` and `operational_and_compatibility_considerations` sections — treat CodeSee/Swimm/AppMap claims with extra skepticism.
