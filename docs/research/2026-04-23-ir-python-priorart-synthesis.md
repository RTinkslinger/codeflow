# Synthesis — IR Shape, Python Extractor, Prior Art

**Date:** 2026-04-23
**Mode:** FULL (all 7 phases)
**Inputs:** 3 ultra-fast research runs + 1 engineering-lead agent review + prior session context (original flowchart-diagramming research + synthesis).
**Question synthesized:** Given the three open decisions (adopt graphology? pick Python extractor? which prior-art IR concepts to import?), what is the integrated recommendation?

---

## 1. Problem statement

`codeflow` is a planned Claude Code plugin: a deterministic code-graph extractor + merger + renderer with browser-preview live reload. User scope: multi-lingual (TS + Python + Go + Swift), "must-be-verifiable" accuracy bar, published plugin quality.

The engineering-lead review flagged two IR must-adds (canonical node identity, edge provenance) and three open questions:
1. **Graph library:** adopt graphology as the TypeScript substrate?
2. **Python extractor:** pyan3 is flagged as abandonware — what replaces it?
3. **Prior-art IR models:** which schemas should we borrow from (SCIP, LSIF, LSP, Kythe, DOT, tree-sitter-stack-graphs, Nuanced's analysis)?

---

## 2. Sources analysed

Four distinct source layers:

| # | Source | Weight | Key outputs |
|---|---|---|---|
| S1 | Research run — TS graph libraries | ~2500 words | Graphology clearly recommended; confirmed live-reload architecture; rising 2024-2026 alternatives are early-stage. |
| S2 | Research run — Python code-graph extractors | ~3000 words | **Major correction:** pyan3 was **revived Feb 2026** (v2.4.0 on 2026-04-03, Python 3.10-3.14). But GPL-2.0 remains a blocker for a published plugin. jarviscg validated by Nuanced post-archival. Layered pipeline recommended. |
| S3 | Research run — prior-art IRs | ~3500 words | SCIP is the clear winner; LSIF superseded; **tree-sitter-stack-graphs archived Sep 2025** (big surprise); Kythe active; LSP is presentation-layer only. Field-level borrowings identified. |
| S4 | Engineering-lead subagent review | prior turn | Called out pyan3 as abandonware (partially wrong per S2), recommended SCIP Symbol.Descriptor (confirmed by S3), recommended graphology (confirmed by S1). |

---

## 3. Convergence map

| ID | Claim | Supported by | Contradicted / qualified by | Status |
|---|---|---|---|---|
| **C1** | Graphology is the right TS graph library for a code-dep IR | S1 (primary recommendation), S4 (eng-lead agreed) | — | Strong convergence |
| **C2** | Live-reload architecture = in-memory graph → versioned JSON → WebSocket/SSE → Web Worker layout (elkjs) → render | S1 (explicit architecture section) | — | Strong convergence |
| **C3** | Wrap graph library's native types in a stable, versioned IR rather than using them directly | S1 (explicit recommendation), S4 (recommended the same), S3 (SCIP discipline) | — | Strong convergence |
| **C4** | pyan3 is abandonware / a risky choice | S4 eng-lead review | **S2:** pyan3 was **revived Feb 2026** (Technologicat/pyan, v2.4.0 on 2026-04-03, supports Python 3.10–3.14) | **Eng-lead was factually wrong about maintenance status** — but right about the product-fit conclusion (see C5) |
| **C5** | pyan3 is not fit for a **published** CC plugin | S2 explicitly: "GPL-2.0… unsuitable for bundling or direct integration into a closed-source commercial plugin" | — | Strong — licensing is the real blocker, not maintenance |
| **C6** | jarviscg is the pragmatic Python primary | S2 (explicit primary recommendation), validated by Nuanced even at archival | S3: also noted Nuanced chose JARVIS. **But jarviscg license is not documented** — S2 explicitly says "license not detailed in provided context." Must verify before commit. | Supported with open risk |
| **C7** | scip-python is the type-aware Python pick | S2 (explicit complementary role), S3 (SCIP ecosystem) | S2: "produces conservative results or misses edges for purely dynamic patterns" — weakness on untyped / dynamic Python | Supported with known limits |
| **C8** | Custom tree-sitter extractor fits as a **fast fallback**, not primary | S2 (explicit tiering) | — | Strong convergence |
| **C9** | SCIP should be the IR's identity + wire-format inspiration | S3 (primary recommendation), S4 (recommended SCIP Symbol.Descriptor) | — | Strong convergence |
| **C10** | Borrow Kythe's VName **philosophy** (separate signature from location), not the full Kythe model | S3 (recommendation verbatim) | — | Supported |
| **C11** | Align field names with LSP `SymbolKind` + `Range` semantics for editor compatibility | S3 (explicit) | S3 qualifier: LSP lacks stable symbol IDs — "not suitable as a backend IR," only as presentation-layer adapter | Supported with caveat |
| **C12** | Adopt a DOT attribute subset (label, shape, style, color, fillcolor, penwidth, arrowhead) as the renderer-agnostic viz layer | S3 (explicit) | — | Strong convergence |
| **C13** | **tree-sitter-stack-graphs is NOT viable — github/stack-graphs was archived September 2025** | S3 explicit | S4 eng-lead called it "v0.1, early-stage" — partially correct but missed the archival | **Eng-lead partially outdated** — stack-graphs is worse off than the review suggested |
| **C14** | Protobuf wire format vs JSON wire format | S3: Protobuf (SCIP) is "4-5x smaller than LSIF" JSONL; "streamable" advantage for LLM tool calls | **Qualifier** from S1 & S3: versioned JSON is easier to debug, Claude can consume JSON directly as tool input without binding generation | Genuine tradeoff — JSON wins for v1 debuggability, Protobuf for v3+ scale |
| **C15** | For a typed TS extractor, use `scip-typescript` (Sourcegraph official, production-grade) | S3 ("most mature indexer… production-grade, 10× faster than lsif-node") | Original design used `dependency-cruiser` — which gives module-deps directly without SCIP overhead | Both valid at different layers; see hypotheses |
| **C16** | Demand-driven / streaming IR generation aligns best with LLM tool-calling | S3 (Nuanced's explicit lesson) | — | Strong — shapes Claude integration story |
| **C17** | Swift has NO official SCIP indexer yet | S3 lists scip-typescript, java, python, go, ruby — **no scip-swift** in the active ecosystem | — | Confirms: Swift roll-own is unavoidable |

Seven rows carry contradiction or genuine qualifier. Hard gate passed.

---

## 4. Three competing hypotheses

### H1 — "Full SCIP alignment, layered Python"
**Mechanism:** Build a SCIP-inspired IR from day 1. Wire format is protobuf-like (possibly literal SCIP for TS and Python, custom extension for Swift/others). Python v1 pipeline = jarviscg (primary) + scip-python (typed codebases) + tree-sitter-python (module-dep fallback) — three tools layered per S2. In-memory = graphology wrapping SCIP schema. LSP field names reused at presentation layer.
**Evidence for:** C1, C3, C6, C7, C8, C9, C10, C11.
**Evidence against:** C14 qualifier (protobuf vs JSON — JSON easier for v1); three-tool Python pipeline adds install friction.

### H2 — "Minimal glue, defer IR complexity"
**Mechanism:** Don't design a SCIP-aligned IR for v1. Graphology's native JSON shape IS the IR; add only the eng-lead's must-adds (canonical identity, edge provenance, schema version). Use `depcruise` for TS module deps, `jarviscg` for Python call graphs, tree-sitter-python for fast module-dep previews. Emit Mermaid directly. Defer SCIP alignment, Kythe VName concepts, LSP field alignment to v2. Ships in 2-3 weeks.
**Evidence for:** C2, C6, C8, C14 (JSON debuggability).
**Evidence against:** C3 (wrap-don't-adopt), C9 (SCIP for identity), C10 (stable cross-repo IDs). No migration path without breaking changes.

### H3 — "Lean on SCIP ecosystem, minimize owned code"
**Mechanism:** Use `scip-typescript` + `scip-python` as the **only** extractors. Consume SCIP binary indexes directly. Your plugin owns very little code — mostly a graphology-based consumer of SCIP, a merger, a renderer. Swift blocked until someone ships scip-swift (or you write a minimal tree-sitter fallback). Accept scip-python's known-conservative accuracy on dynamic Python.
**Evidence for:** C9, C15, C16 (SCIP streamable for LLM tool calls), C3 (minimal wrap).
**Evidence against:** C7 qualifier (scip-python misses dynamic Python edges — user's "verifiable" bar suffers silently), C17 (no scip-swift, so user's real iOS use case blocked), C15 counter (depcruise gives module deps more directly than SCIP).

Collapse test: H1 owns a SCIP-inspired IR and uses multiple extractors. H2 owns graphology-native IR with a short tool list. H3 owns little code and leans on SCIP's ecosystem. They differ meaningfully on *what the plugin owns* (IR design, extractor orchestration, or neither).

---

## 5. Pre-mortem — specific failure modes

### H1 fails because…
- **F1a (C6 open risk):** jarviscg's license is not yet verified. If turns out GPL-like, the primary Python extractor is disallowed for a published plugin and the three-tool pipeline collapses to two (scip-python + tree-sitter). Primary Python accuracy drops from S2's 60-90% bar to scip-python's narrower band.
- **F1b (C14 qualifier):** Shipping a protobuf wire format means user/Claude can't `cat current.json` and read it during debugging. The v1 "browser preview + user inspects output" loop gets a translation step. Marginal but real friction.
- **F1c (C7 contradiction):** SCIP Symbol.Descriptor stability for Python depends on strict indexer convention. Runtime-generated methods (metaclass-produced, monkey-patched) get unstable IDs. The "one file → one node" invariant breaks at the Python/TS boundary when Python generates `.ts` stubs via codegen — exactly the scenario the eng-lead flagged.
- **F1d:** Six weeks of schema design before v1 utility is visible. Momentum risk on a solo-maintained plugin.

### H2 fails because…
- **F2a (C3, C9 contradictions):** Graphology-native IR has no stable cross-repo identity. v2 features like "diff two versions of the same codebase" or "cache across runs" break at the IR layer. Migrating to SCIP-aligned identity in v2 is a breaking schema change — every published plugin consumer re-integrates.
- **F2b (C17 silent miss):** No language-agnostic identity means cross-language edges (TS calling Python) in v2 need a made-up identity scheme invented just for this plugin. Reinventing what SCIP already solved.
- **F2c:** Pure JSON + Mermaid-only v1 works, but renderer layer rewrite for D2 + future call-graph types is larger than H1's because there's no intermediate IR to refactor — everything is tangled with graphology attributes.
- **F2d:** The "must be verifiable" bar depends on identity stability. Without SCIP-style descriptors, two extractor runs can show the same symbol under different IDs, breaking the user's trust: "last time this said X, now it says Y, did my code change or did the tool?"

### H3 fails because…
- **F3a (C7 explicit):** scip-python is "conservative on dynamic Python patterns." User's stated "must-be-verifiable" bar means user must trust what's rendered. scip-python failing silently on dynamic code (which is most Python) produces a graph that's accurate but incomplete — the worst kind of quiet error.
- **F3b (C17 blocker):** Swift is the user's stated real driver ("specific iOS/macOS codebase"). There is no scip-swift. H3 has no answer for Swift — defer by 1+ years waiting for community to ship. H1 and H2 also don't solve Swift, but H3 has the least leverage when it's time to add it (you can't bolt tree-sitter on top of an SCIP-consumer architecture cleanly).
- **F3c (C15 counter):** `dependency-cruiser` directly produces module-dep graphs in Mermaid/DOT with low friction. Extracting equivalent info from scip-typescript requires walking Occurrence.roles and synthesizing import edges — more code than just running depcruise. You've added engineering to replace a working tool.
- **F3d:** Three install steps for the user (scip binary, scip-typescript npm, scip-python pip) without the orchestration of a fallback means "scip-typescript failed to parse your tsconfig" is a full stop, not a degradation.

---

## 6. Integrated recommendation

### The synthesis

**None of H1, H2, H3 wins alone. The right answer imports H1's IR discipline, H2's wire-format pragmatism, and H3's lean on the Sourcegraph ecosystem for TS specifically — while keeping the layered Python pipeline (in a corrected shape).**

**Concrete integrated recommendation:**

#### 6.1 IR shape — H1-inspired, H2-pragmatic

```
IR on wire (v1):        versioned JSON, SCIP-schema-inspired
                        {schemaVersion: "1", extractor: {...}, root, documents, symbols, relationships}
IR in memory:           graphology MultiDirectedGraph with typed attributes (per C1, C3)
Node identity:          SCIP Symbol.Descriptor grammar (scheme.manager.package.descriptor) — C9
                        Language is a FIELD on the node, not part of the ID — prevents eng-lead's
                        "one file → two nodes" polyglot bug (§8 sharpest risk from the review)
VName philosophy:       separate {signature, corpus, path} as advised by C10 — baked into how
                        Symbol.Descriptor is constructed, not a second identity system
LSP alignment:          borrow SymbolKind enum + Range/selectionRange semantics as fields (C11);
                        do NOT make IR a DocumentSymbol subtype
Viz layer:              DOT attribute subset (C12): {label, shape, style, color, fillcolor,
                        penwidth, arrowhead} — renderer-agnostic
Migration path:         JSON v1 → optionally protobuf v3 if throughput demands it (C14); schema
                        versioning from day 1 means this isn't breaking
```

**Why this survives its own pre-mortem:**
- F1b disarmed: JSON for v1 keeps debuggability; protobuf is the v3 optimization if needed.
- F1c disarmed: language is a node field, not part of the ID, so codegen scenarios don't dup.
- F2a/b disarmed: stable identity from day 1 means v2 additions are extensions, not breaking migrations.

#### 6.2 Extractor lineup — revised from the original design

| Language | Primary | Fallback | Why |
|---|---|---|---|
| TypeScript/JavaScript | **scip-typescript** (Sourcegraph official) | `dependency-cruiser` for pure module-deps if SCIP overkill | C15. Prod-grade, Apache-2.0, SCIP-native. depcruise remains a lightweight option for module-deps-only mode. |
| Python | **scip-python** (primary for typed codebases) + **jarviscg** (fallback for dynamic codebases where scip-python under-reports) | tree-sitter-python for instant module-dep preview | C7. Use scip-python when type coverage is decent; fall through to jarviscg otherwise. Mark jarviscg edges as `confidence: inferred-high` (C7). |
| Go | scip-go (Sourcegraph maintained) | go-callvis for call graphs | C15 ecosystem applies. |
| Swift | roll-own: tree-sitter-swift + minimal own extractor | — | C17. No scip-swift in 2026. User's iOS driver means this is v3+ work; design the IR to accept SCIP-like input from any extractor. |

**pyan3 is explicitly OUT** — even though it was revived Feb 2026 (C4 correction), its GPL-2.0 license (C5) makes it incompatible with a published CC plugin. This is the one place the eng-lead reached the right conclusion via partially-wrong reasoning: pyan3 is NOT abandonware, but IS disqualified.

#### 6.3 What the plugin actually owns — minimized via H3 insights

- A graphology-based in-memory IR (wraps SCIP-inspired schema)
- A merger that normalizes Symbol.Descriptor identity across extractor outputs
- A renderer: IR → Mermaid (v1), IR → D2 (v2)
- A preview server: adapted from `veelenga/claude-mermaid`'s live-reload pattern (MIT, attribute)
- A slash-command shim + `.mcp.json` + fallback CLI

Everything else — TS extraction, Python extraction, protobuf tooling if ever adopted — is someone else's code (Sourcegraph's or Nuanced's), invoked as subprocesses or libraries.

#### 6.4 v1 scope cut — aligned with user's staged roadmap

- **Languages:** TypeScript + Python (Go, Swift deferred)
- **Diagram type:** module dependency graph only
- **Renderer:** Mermaid only
- **Display:** browser live-reload via adapted preview layer
- **IR:** SCIP-inspired JSON with full identity + provenance + viz layer
- **Accuracy target:** 80-90% edge recovery on well-typed codebases, 60-80% on dynamic ones (S2's honest numbers)

### Why this integrated recommendation survives

| Failure mode | How the synthesis disarms it |
|---|---|
| F1a (jarviscg license risk) | **Open action item**: verify jarviscg license before committing. Fallback: drop jarviscg, accept scip-python's narrower accuracy band for v1. |
| F1c (dedupe break on codegen) | Language-as-field-not-in-ID + canonical path resolution before merge. |
| F2a (no migration path) | SCIP schema from v1 means v2 extensions are additive, never breaking. |
| F3a (silent scip-python misses) | Keep jarviscg fallback; mark confidence explicitly per edge. Don't let the user trust edges they shouldn't. |
| F3b (Swift blocker) | Roll-own tree-sitter extractor for Swift when v4 arrives; the IR already supports SCIP-like input from non-SCIP sources. |

### What this recommendation CANNOT solve

1. **jarviscg license is unverified.** Research explicitly said "license not detailed." Must fetch the repo's LICENSE before the primary Python fallback is confirmed usable. (Action item, below.)
2. **scip-python's conservatism on dynamic Python.** No tool recovers 100% of edges in dynamic code. The honest bar is 60-80%; it must be communicated to users as product copy, not hidden.
3. **Swift has no official indexer.** v1 and v2 do not serve the user's iOS driver. Design the IR to be extractor-agnostic so when v4 rolls out a tree-sitter-swift extractor, it fits the same IR without rework.
4. **Cross-language edges (TS calling Python service) remain v2-deferred.** Not in v1 scope.
5. **Eng-lead review's pyan3 claim was half wrong.** Tool reviews get stale fast — this is a reminder to verify maintenance status at the moment of adoption, not rely on stored knowledge.

---

## 7. Open questions

1. ~~**Verify jarviscg's actual license**~~ — **RESOLVED 2026-04-23 via direct gh API inspection**:
   - `nuanced-dev/jarviscg` is **archived** (last update 2026-03-05) and has **no LICENSE file**.
   - Upstream `pythonJaRvis/pythonJaRvis.github.io` has **no LICENSE file**. Directory layout (`dataset/`, `ground_truth/`, `reproducing_RQ1/`, `reproducing_RQ2/`) reveals it's an **academic-paper research artifact**, not a maintained tool. Academic code without a license is legally unusable for redistribution.
   - **Decision: jarviscg is OUT.** Python v1 strategy collapses to: **scip-python** (primary, Apache-2.0, Sourcegraph-maintained) + **tree-sitter-python** (fast-preview fallback, MIT). No third layer.
   - **Accuracy bar revised**: ~60-80% edge recovery on dynamic Python (scip-python alone), 80-90% on well-typed Python (unchanged). Slightly narrower than the layered estimate but **honest** about what static+typed analysis can see.
   - **S2 research correction**: the Python extractors research's primary recommendation (jarviscg primary, scip-python complementary) is **invalidated by due-diligence**. The research's finding that "Nuanced validated JARVIS" was true when written but Nuanced's fork was archived a month before Nuanced's company archival — the endorsement was trailing-edge, not forward-looking.
2. **Benchmark scip-python on a real Python codebase.** What does "60-80% recovery on dynamic code" look like in the user's actual target repos? Worth a spike before committing v1 scope.
3. **Does scip-typescript's output map cleanly to a module-dep-only view?** If not, retain `dependency-cruiser` as a parallel extractor for module-deps view, use scip-typescript for call-graph view in v2.
4. **LSP `SymbolKind` adoption — numeric enum or mirrored string enum?** Numeric is LSP-exact; string is debuggable JSON. Minor but impacts wire format.
5. **Is `veelenga/claude-mermaid`'s preview server cleanly extractable, or will adapting it require a fork?** Affects whether v1 can reuse its live-reload code or must reimplement.

---

## 8. What changes in the running design (feeds back to brainstorm)

Changes to apply to the Section-1 architecture when brainstorming resumes:

1. **IR is no longer the 4-field sketch** from the original design — it becomes a SCIP-inspired versioned JSON schema with LSP-aligned fields, graphology-wrapped in-memory. (Section 6.1 above.)
2. **Python extractor list changes:** pyan3 → out (GPL). jarviscg → primary **fallback** for dynamic code (pending license verification). scip-python → **primary** for typed code. tree-sitter-python → fast-preview fallback.
3. **TS extractor changes:** scip-typescript joins depcruise. Decide during writing-plans which is the v1 primary based on whether v1 is module-deps-only (depcruise wins) or already planning call graphs (scip-typescript wins).
4. **New infrastructure owned:** a Symbol.Descriptor canonicalizer (normalizes paths, resolves symlinks, produces stable IDs regardless of which extractor saw the file). This is the merger's precondition per the eng-lead's "sharpest risk."
5. **Visualization layer added:** `viz` block per node/edge with the DOT attribute subset, translated per-renderer.
6. **Explicit v1 accuracy bar added:** 80-90% typed / 60-80% dynamic. Communicated in UI copy.

These are the concrete changes to bring back into the brainstorming Section 1 approval.

---

## Validator

Spawning adversarial validator subagent to pressure-test this synthesis per the research-synthesis skill's Phase 7 gate.
