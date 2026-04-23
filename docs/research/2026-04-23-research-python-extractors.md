# Executive Summary

This comparative analysis of Python code-graph extraction tools for 2026 reveals a fragmented but mature market with no single 'silver bullet' solution. The primary challenge remains the accurate static analysis of Python's dynamic features, particularly dynamic dispatch, decorators, and metaclasses, which are common failure modes for purely syntactic or older static analyzers. Our review of tools including pyan3, scip-python, PyCG, 'Jarvis', custom tree-sitter extractors, type checkers (pytype, Pyre, mypy), and various LSP servers (pyright, pylsp, Jedi) indicates that a hybrid approach is necessary to achieve a balance of accuracy, performance, and maintainability. Older tools like pyan3 and the academic PyCG suffer from a lack of active maintenance, making them risky for production use despite their foundational concepts. Modern, type-aware tools like scip-python (leveraging Pyright) offer high precision for well-typed codebases but still have gaps with highly dynamic patterns. A custom tree-sitter-based extractor is fast and easy to implement for shallow, syntactic analysis but fails to capture deep semantic relationships. The final recommendation for a v1 TypeScript plugin is a pragmatic, layered strategy: use 'Jarvis' (`jarviscg`) as the primary, CLI-based extractor, valued for its balance and proven use in production by Nuanced. This should be complemented with `scip-python` to generate rich, type-aware indexes for codebases that support it. A lightweight, custom tree-sitter extractor should be used as a fast fallback for generating immediate UI previews of module dependencies. This approach is expected to miss 20-40% of call edges in the most dynamic codebases but aims to recover 80-90% of edges in well-typed projects, setting a realistic quality bar for v1.

# V1 Tooling Recommendation

## Primary Extractor

Jarvis (`jarviscg`): This tool is recommended as the main extractor for v1. It is a pragmatic, demand-driven call-graph generator that is easy to integrate via a CLI. Its selection was notably validated by the company Nuanced for their own agentic coding products, as reaffirmed in their April 2026 archival post, indicating it provides a reasonable balance of coverage and simplicity for real-world codebases.

## Complementary Indexer

scip-python: To augment the primary extractor, scip-python is recommended as a secondary indexer. It leverages the Pyright type checker to produce a highly accurate, type-aware SCIP index. This is particularly valuable for modern, well-typed Python projects, where it can significantly improve the accuracy of symbol linking and call-edge resolution, providing deeper semantic insights than Jarvis alone.

## Fast Fallback

Tree-sitter-based custom extractor: A lightweight, custom-built extractor using the `tree-sitter-python` grammar in TypeScript is recommended for providing fast, initial previews. This tool can quickly generate a module-dependency graph and identify basic syntactic structures, offering immediate feedback in the UI while the more comprehensive analysis from Jarvis and scip-python runs in the background.

## Deferred To V2

Heavy type-checker pipelines (pytype, Pyre, mypy) and full, direct LSP integration: The integration of full-fledged type-checking pipelines or building a complex client to manage multiple LSP servers should be deferred to a future v2 release. While powerful, these approaches introduce significant engineering complexity, performance overhead, and configuration burden that would increase the risk and timeline for the initial v1 product launch.


# V1 Expected Accuracy

## Dynamic Dispatch Heavy Codebases Miss Rate

20%–40%: For codebases that make extensive use of dynamic features like runtime attribute assignment, metaprogramming, monkey-patching, and plugin architectures, the recommended v1 static analysis pipeline is expected to miss between 20% and 40% of true runtime call edges.

## Typical Codebases Miss Rate

10%–20%: For typical, well-structured Python applications with moderate use of dynamic features and some type hinting, the expected miss rate for runtime call edges is lower, estimated to be in the range of 10% to 20%.

## Dynamic Dispatch Heavy Codebases Recovery Rate

60%–80%: The product goal for v1 should be to successfully identify and recover (recall) approximately 60% to 80% of the total call edges within projects that are heavy on dynamic dispatch.

## Well Typed Codebases Recovery Rate

80%–90%: For projects that are well-typed and follow modern Python idioms, the target recovery rate is higher, aiming for 80% to 90% of call edges. This higher accuracy is achievable due to the complementary use of scip-python, which leverages type information for more precise resolution.


# Python V1 Deferral Tradeoff

An analysis of the trade-off of deferring Python support to a v2 release reveals a classic conflict between time-to-market and market opportunity. 

**User Value:** Deferring Python support means forgoing a very large and active segment of the developer market for the v1 launch. The extensive research conducted into the nuances of Python tooling implies that Python developers are a key target audience. Shipping a TypeScript-only v1 would deliver value to a smaller initial user base and delay addressing a critical market.

**Engineering Risk:** The collective findings demonstrate that providing high-quality Python code-graph extraction is a significant engineering challenge. The landscape is fraught with unmaintained tools (PyCG, pyan3), complex integrations (LSPs, type checkers), and fundamental limitations in static analysis of dynamic code. Adopting the recommended hybrid approach (Jarvis + scip-python + tree-sitter) still requires integrating, managing, and orchestrating three separate tools, which carries non-trivial implementation and maintenance risk. Deferring Python support would mitigate this risk, allowing the team to focus on perfecting the core product and delivery pipeline with a potentially simpler language ecosystem (TypeScript) first.

**Roadmap Implications:** Shipping a TypeScript-only v1 would likely result in a faster, more stable initial release. It would allow the team to gather user feedback on core features before tackling the complexities of Python. However, it pushes a major, high-risk, and high-reward feature into a v2, which could be a significant delay. The decision hinges on strategic priorities: a faster path to a narrower market (TS-only v1) versus a slower, higher-risk path to a much larger market (including Python in v1). Given the complexity, a v1 launch without Python could be a prudent step to de-risk the project, provided there is a clear and committed roadmap for delivering Python support in a fast-follow v2 release.

# Tool Comparative Analysis

## Tool Name

pyan3

## Maintenance Status 2024 2026

The tool was revived in February 2026 under the 'Technologicat/pyan' repository after the original 'davidfraser/pyan' was archived. It received a new release (v2.4.0) on April 3, 2026, and supports modern Python versions (3.10-3.14). This indicates a recent and active return to maintenance after a period of dormancy.

## Accuracy On Dynamic Features

Pyan3 demonstrates good static resolution for lexically resolvable patterns, including MRO-aware `super()` resolution and inherited attributes. It detects `async def` syntax. However, its accuracy is notably limited for dynamic features. It explicitly cannot resolve call targets that depend on the results of arbitrary function calls, factory functions, heavy metaprogramming, or reflection, which will result in incomplete graphs for dynamic-dispatch-heavy codebases.

## Type Hint Support

The tool does not currently use type hints to improve inference accuracy. This capability is listed as a 'TODO' item in its development roadmap, meaning it relies purely on syntactic and structural analysis.

## Output Formats

It offers a versatile range of output formats, including DOT for Graphviz visualization, SVG, HTML, plain text, TGF, yEd, and a JSON-like text option available through its Python API, providing flexibility for integration.

## Installation Method

Installation is straightforward via `pip install pyan3`. The latest development version can also be installed directly from its Git repository. For graph visualization, it has an external dependency on Graphviz.

## Licensing

GPL-2.0. This is a significant constraint, as the copyleft nature of the license imposes strict requirements on the distribution of derivative works, making it problematic to bundle within a proprietary, closed-source commercial plugin.

## Suitability Score

6/10. The tool's recent modernization and active revival are strong positives. However, its restrictive GPL-2.0 license and documented weaknesses in handling dynamic dispatch make it a risky choice for direct integration into a commercial product. Its use would likely be limited to an external, separately invoked tool.

## Tool Name

scip-python

## Maintenance Status 2024 2026

Actively maintained by Sourcegraph with a steady release cadence and consistent commit activity throughout the 2024-2026 period. It is considered a mature, production-capable indexer backed by a commercial entity.

## Accuracy On Dynamic Features

Accuracy is highly dependent on the presence of type annotations. As it is built on Pyright, it excels at resolving call targets in well-typed code. However, it produces conservative results or misses edges for purely dynamic patterns such as runtime metaprogramming, reflective calls, monkey-patching, and complex decorators that dynamically replace callables. It indexes `async` functions but does not model the underlying event-loop semantics.

## Type Hint Support

Excellent. The tool is explicitly designed to leverage type information. It uses Pyright's type analysis engine and fully supports PEP 484 type hints and `.pyi` stub files to significantly improve the precision of call resolution and symbol linking.

## Output Formats

The primary output is a language-agnostic SCIP (Source Code Index Protocol) index, which is a compact Protobuf binary format. The associated `scip` CLI tool can then be used to convert this index into more accessible formats like JSON snapshots or DOT files for debugging and inspection.

## Installation Method

The toolchain involves multiple components. The indexer itself is installed via `pip install scip-python`. This is used in conjunction with the `scip` CLI, a separate binary (built in Go/Rust) available from Sourcegraph's releases. The setup may also require Node.js and Pyright.

## Licensing

Apache-2.0. This permissive license is suitable for commercial use and allows for redistribution, making it a safe choice for integration into a proprietary plugin.

## Suitability Score

High for typed codebases. Its use of a standardized index format (SCIP) and a mature type checker (Pyright) are major advantages. The primary caveat is its degraded accuracy on untyped, highly dynamic code. It is a strong candidate, particularly as a complementary tool for providing type-aware intelligence.

## Tool Name

pycg

## Maintenance Status 2024 2026

Effectively unmaintained. The official upstream repository was archived by its owner in November 2023 and is now read-only. There has been no active development, bug fixes, or updates to support newer Python versions during the 2024–2026 period.

## Accuracy On Dynamic Features

Based on its original 2021 research paper, the tool handles multiple inheritance and higher-order functions. However, it has significant documented limitations, as it ignores `eval`, `getattr`/`setattr`, and the effects of built-in functions. Its support for complex decorators, metaclasses, and modern `async` patterns is either partial or non-existent, leading to accuracy gaps in real-world production code.

## Type Hint Support

None. The tool's static analysis algorithm is based on constructing an assignment graph from the AST and does not leverage type hints to improve the precision or recall of its call graph generation.

## Output Formats

It generates call graphs in a JSON format, as described in its accompanying academic paper.

## Installation Method

It is packaged as a standard Python 3 tool. However, its archived status means it is not guaranteed to be compatible with modern Python interpreters (3.10 and newer) and may require manual code modifications to run.

## Licensing

Apache-2.0. The license is permissive and poses no barriers to commercial use.

## Suitability Score

4/10. While its academic approach is sound and its license is permissive, the unmaintained and archived status of the project is a major blocker for production use in 2026. Adopting it would require a significant engineering investment to fork, update, and harden for modern Python environments.

## Tool Name

jarvis (jarviscg)

## Maintenance Status 2024 2026

Considered stable and production-ready. Although primary development may have slowed, community forks and releases continued through 2025. Its viability is strongly validated by its continued use in production by the company Nuanced, which re-affirmed it as their chosen extractor in an April 2026 post.

## Accuracy On Dynamic Features

Described as having 'reasonable coverage for real-world codebases,' positioning it as a pragmatic static analyzer. For codebases heavy with dynamic dispatch, it is estimated to miss between 20% and 40% of runtime call edges. This level of accuracy represents a practical trade-off between the speed of static analysis and the completeness of runtime analysis.

## Type Hint Support

The provided information does not indicate a strong reliance on type hints for its analysis. The recommendation to pair it with a type-aware tool like scip-python suggests that Jarvis provides a robust static analysis baseline without performing deep type inference itself.

## Output Formats

Outputs call graph data in a flexible JSON format or as a simple edge-list, both of which are easy to parse and consume by downstream tooling.

## Installation Method

It is distributed as a standard package on the Python Package Index (PyPI) and can be easily installed using `pip install jarviscg`.

## Licensing

The specific license is not detailed in the provided context. However, its distribution on PyPI and adoption by a commercial entity for a core business function strongly suggest it is under a permissive open-source license, such as MIT or Apache-2.0.

## Suitability Score

High. It is the top recommendation for a version 1 plugin. Its suitability is supported by its proven real-world use case with Nuanced, its straightforward CLI integration, and its pragmatic balance of performance and accuracy. It serves as a practical, off-the-shelf solution.


# Custom Treesitter Extractor Analysis

## Extractable From Ast

From the Abstract Syntax Tree (AST) or tree-sitter parse tree alone, it is reliable to extract syntactic structures. This includes: module and package imports (both `from/import` statements and aliased imports); top-level and nested function and class definitions, including their names and parameter lists; explicit static calls where the callee is a simple name or a dotted attribute expression written in the source (e.g., `module.func()`); the syntax of decorator expressions; literal values; `async`/`await` syntax nodes; `with`/`async with` context manager syntax nodes; dunder/magic method definitions (e.g., `def __init__`); comprehension structures (list, dict, set, generator); and basic control flow and data-flow patterns like assignment targets and attribute access nodes. The syntactic arguments and location (file, line, column) of call sites are also reliably extractable.

## Requires Semantic Info

Accurate extraction of several key features requires semantic or type information that is not available from the AST alone. This includes: the precise resolution of polymorphic or dynamic dispatch (i.e., determining which specific implementation of `obj.method` will be invoked at runtime); resolving the origin of an attribute (e.g., determining if `x.a` is a function, a property, or a data attribute); identifying call targets created via metaprogramming (e.g., using `setattr`, `exec`, or `importlib`); resolving dynamically computed imports; understanding the effects of monkey-patching; determining the runtime behavior of decorators that modify or replace call targets; identifying methods generated at runtime by metaclasses or class decorators; and tracking the identity of higher-order functions when they are passed through variables. Distinguishing between a descriptor, a function, and a data attribute also requires a semantic model.

## Expected Miss Rate

For codebases that are heavy on dynamic dispatch (e.g., extensive use of duck typing, runtime attribute assignment, metaprogramming, complex decorators, or plugin architectures), a purely syntactic extractor is expected to have a high miss-rate on true call edges. Empirical studies and literature suggest that while a pure AST-based approach might capture 40-70% of static call edges in typical applications, the recall for dynamic features can drop significantly. For highly dynamic codebases, the recall may be as low as 10-40%, which translates to an expected miss-rate of 60-90% of call edges.

## Estimated Effort

The development effort to build a production-grade extractor in TypeScript using tree-sitter is significant and can be broken down into phases: a prototype (handling basic parsing, node-walking, a simple symbol table, and JSON export for functions, classes, imports, and static calls) would take approximately 1-2 person-months. An enhanced version (adding heuristics for common decorators/descriptors, basic inter-file name resolution, and limited type inference for built-ins) would require an additional 3-6 person-months. A fully production-grade extractor with robust cross-file resolution, packaging, CI/CD, fast incremental parsing, and comprehensive test coverage would take 6-12+ person-months of effort for a small team.

## Maintenance Burden

The long-term maintenance burden is expected to be moderate. It primarily involves tracking changes to the upstream `tree-sitter-python` grammar, which may require updates to the extractor to support new Python syntax features. This is estimated to take 1-2 days of work per notable Python syntax release, plus testing. An allocation of approximately 0.1-0.3 FTE per year per engineer is recommended for ongoing maintenance, which includes tracking grammar updates and changes to TypeScript bindings or WASM artifacts.

## Licensing

The licensing constraints are minimal and permissive for commercial use. The core `tree-sitter` library and the `tree-sitter-python` grammar are both distributed under the MIT license. This allows for integration into proprietary, closed-source commercial products without issue, though it is always best practice to confirm the license of the specific version being used.

## Recommendation For V1

A 'Go' recommendation is given for building a custom tree-sitter-based extractor for a v1 product. It should target syntactic call-graph coverage, including imports, definitions, static/dotted calls, and representing decorators as metadata. This approach is a low-cost, fast baseline that is easy to ship and can capture a majority of straightforward call edges. However, it is crucial to acknowledge its limitations. The recommendation includes caveats to mark extracted edges with confidence levels and to design the system with hooks to augment the graph with more accurate data from LSPs or type checkers in a future v2 release. This path is not recommended if high recall on dynamic code is a hard requirement for v1.


# Type Checkers As Source Analysis

## Tool Name

pytype, Pyre, mypy

## Call Graph Extraction Mechanism

These tools do not typically offer a direct, out-of-the-box call-graph generation mode. Instead, a call graph must be inferred by consuming their primary outputs. The mechanism involves running the type checker on the codebase and then performing custom extraction on the resulting artifacts, which are typically diagnostics reports and a typed Abstract Syntax Tree (AST). An external tool or script is required to traverse this typed AST, identify call sites, and use the resolved type information to link them to function or method definitions, thereby constructing the call graph.

## Accuracy On Dynamic Dispatch

Type checkers can significantly improve the accuracy of call-graph extraction compared to purely syntactic methods, especially in codebases with good type hint coverage. They provide type-resolved information that helps in correctly identifying the target of a call. However, their accuracy on dynamic dispatch is not perfect. They require a full type-checking configuration to be effective and may still miss call edges that are generated purely at runtime (e.g., through `eval`, heavy metaprogramming, or runtime monkey-patching) and are not visible through static analysis, even with type information.

## Output Formats

The primary outputs of these tools are not direct call graphs in formats like DOT or JSON. Instead, they produce structured diagnostics (error and warning messages) and, more importantly for this use case, an internal representation of the code's structure, often in the form of a typed Abstract Syntax Tree (AST). This typed AST is the main data source from which call graph edges would need to be extracted.

## Maintenance Status 2024 2026

All three tools—pytype (Google), Pyre (Meta), and mypy (Dropbox-origin/community)—are described as actively maintained open-source projects with strong backing. They have consistent development activity and releases through the 2024-2026 period, indicating long-term support and ongoing improvements to keep up with the Python language and its typing features.

## Licensing

As actively maintained open-source projects, these tools are distributed under permissive licenses (such as MIT or Apache 2.0), which generally allow for commercial use and redistribution. For example, mypy is licensed under the MIT License. This makes them suitable for integration into a commercial TypeScript plugin without significant licensing constraints.


# Lsp Servers As Source Analysis

## Server Name

pyright, python-lsp-server (pylsp), Jedi Language Server

## Exposed Data

LSP servers expose rich semantic information about code that can be used to infer call edges. The primary mechanism is to query the server for `textDocument/definition` and `textDocument/references`. For a given function definition, a `references` request will return all locations where that function is called. By iterating through functions and collecting these references, a call graph can be constructed. Servers like `pyright` provide detailed type information on hover, while `pylsp` and `Jedi` offer completions and type inference. `ruff-lsp` is an exception, as it primarily focuses on diagnostics (linting) and exposes limited symbol information, making it unsuitable for this purpose.

## Dynamic Dispatch Coverage

The coverage of dynamic dispatch varies significantly among servers. `pyright` relies heavily on static type hints (PEP 484) for accuracy and will only partially resolve dynamic calls without them. `python-lsp-server` (pylsp), often using `Jedi` as a backend, offers better coverage for dynamic code because Jedi can perform some forms of static analysis that mimic runtime inspection. The standalone `Jedi Language Server` has the strongest coverage of dynamic Python patterns among the three, as the underlying Jedi engine is designed to handle such cases through sophisticated static analysis.

## Output Possibilities

The standard output format for all LSP servers is raw JSON conforming to the Language Server Protocol specification. This consists of JSON-RPC request and response objects. For direct call-graph formats, `pyright` is a notable case; a fork known as `scip-python` is built on `pyright` and can directly export a SCIP (Source Code Index Protocol) index, which is a structured format for code intelligence data. Other servers like `pylsp` and `Jedi` do not have native SCIP export capabilities, so their raw LSP JSON output would need to be transformed into a graph format like DOT or a custom JSON structure.

## Maintenance Status 2024 2026

The viable LSP servers for this task demonstrate healthy and active development during the 2024-2026 period. `pyright` (backed by Microsoft) shows ongoing activity and discussions on its GitHub repository. `pylsp` has steady commits reflected in package repositories. The `Jedi` project and its language server wrapper also show moderate but consistent activity with recent releases to maintain compatibility. This indicates that these are reliable, long-term choices.

## Licensing

The major Python LSP servers are distributed under permissive open-source licenses, making them suitable for commercial integration. `pyright`, `python-lsp-server`, and `Jedi Language Server` are all licensed under the MIT License.

## Integration Complexity

The complexity of integrating an LSP server into a TypeScript plugin is generally low to moderate. For servers like `pylsp` and `Jedi`, which adhere closely to the standard LSP specification, integration is simplified as many libraries exist for LSP communication. The complexity is rated as 'low'. For `pyright`, it is rated 'moderate' as it may involve more specific configuration and mapping of its rich type information to the plugin's internal structures. The core task involves implementing a JSON-RPC client in TypeScript to communicate with the headless LSP server process.


# Jarvis Tool Case Study

## Repository Details

The tool is publicly distributed on the Python Package Index (PyPI) under the package name `jarviscg`, making it easily accessible for installation in standard Python environments.

## Output Format

It produces call graph data in a machine-readable JSON format or as a simple edge-list. This standard output is designed for easy consumption by other programs and toolchains.

## Maintenance Status

The tool had active forks and releases continuing through 2025. Its status as a stable, production-worthy tool was significantly validated in April 2026 when its user, Nuanced, publicly reaffirmed its role as their production extractor, indicating it meets long-term maintenance and stability requirements.

## Nuanced Selection Rationale

Nuanced reportedly selected Jarvis for its pragmatic characteristics. The key reasons cited were its 'demand-driven call-graph generation,' suggesting efficiency; its 'ease of CLI integration,' which simplifies its inclusion in a larger automated workflow; and its 'reasonable coverage for real-world codebases,' highlighting a practical balance between analytical depth and performance.

## Nuanced Validation 2026

Yes, the choice was explicitly validated long after its initial selection. A public archival post by Nuanced on April 8, 2026, re-affirmed that Jarvis remained the production extractor for their AI agents. This subsequent, long-term endorsement confirms that the tool successfully met their production needs and validated their initial pragmatic choice.


# Emerging Tools Market Scan

## Company Name

Nuanced

## Founded Year

2023.0

## Description

Nuanced is a San Francisco-based startup from the Winter 2024 Y-Combinator batch. It provides a spec-driven development workspace designed for agentic coding, with the goal of keeping the user's intent, design, and final code execution aligned. The platform is built to enhance the capabilities of AI coding agents by providing them with a deeper understanding of code structure.

## Key Features

Nuanced offers a static-analysis server that generates precise TypeScript call graphs. Its key features include a spec-driven workspace to clarify intent for AI agents, a containerized Language Server Protocol (LSP) that provides cross-file and cross-language code navigation, and the ability to generate relationship data for Python modules. These features are designed to enable AI agents to make more accurate code edits, accelerate build times, and reduce the number of tokens used during generation.

## Open Source Component

The company has released an open-source Python library available on GitHub under `nuanced-dev/nuanced`. This library provides code-structure awareness for AI coding tools. It can be used via a command-line interface with commands such as `nuanced init .` to analyze a codebase and `nuanced enrich app/file.py function_name` to retrieve specific relationship data for a given function.

## Integration Points

Nuanced is designed to integrate directly with AI coding agents to make them more effective. The documentation specifically mentions integrations with agents like Cursor and Claude Code, which can consume the call-graph information generated by the tool. Furthermore, its containerized API exposes real language servers, allowing it to serve as a backend for various development tools requiring cross-file code intelligence.


# Dynamic Dispatch Coverage Comparison

Handling dynamic dispatch is a significant challenge for static analysis tools, and the evaluated options show a wide range of effectiveness. 

*   **pyan3**: As a purely static analyzer, `pyan3` has explicit limitations. It cannot resolve the results of arbitrary function calls, factory functions, reflection, or monkey-patching. While it can handle some object-oriented patterns like MRO-aware `super()` calls, it produces incomplete or approximate graphs for codebases heavy with dynamic patterns, often marking nodes as unknown.

*   **scip-python**: This tool leverages the Pyright type checker, so its ability to resolve dynamic dispatch is heavily dependent on the presence and accuracy of type hints. With good type coverage, it can resolve many dispatch cases. However, for purely dynamic behavior like reflective calls, runtime-generated callables, or monkey-patching, it will either miss the call edges or produce conservative, over-approximated results.

*   **pycg**: This academic tool also has known limitations. It explicitly ignores `eval`, `getattr`, and `setattr`, which are common mechanisms for dynamic behavior. Its reported recall of approximately 70% suggests significant gaps, particularly in resolving calls that are not lexically apparent.

*   **Jarvis (`jarviscg`)**: As the tool chosen by Nuanced for production use, Jarvis is described as a pragmatic choice with 'reasonable coverage'. The analysis estimates that even with a best-in-class static pipeline combining Jarvis and `scip-python`, one should expect to miss 20-40% of runtime call edges in dynamic-dispatch-heavy codebases.

*   **Custom tree-sitter extractor**: A custom extractor based solely on `tree-sitter`'s parse tree would be the least effective. It can only identify syntactic call patterns and cannot resolve any form of dynamic dispatch, as it lacks semantic and type information. Its recall on dynamic code could be as low as 10-40%.

*   **Type Checkers (pytype, pyre, mypy)**: These tools can improve edge recovery by using type inference, but they still struggle with runtime-generated calls and require significant configuration to be effective.

*   **LSP Servers**: The effectiveness varies. `pyright` is similar to `scip-python`, relying heavily on type hints. In contrast, `pylsp` and `jedi-language-server`, which use the Jedi engine, have somewhat better coverage for dynamic code because Jedi can perform limited runtime inspection. However, they are still not comprehensive and will miss highly dynamic patterns. `ruff-lsp` is unsuitable as it focuses on linting, not call analysis.

# Output Format Integration Comparison

The evaluated tools emit a variety of graph formats, each with different implications for integration with a TypeScript-based plugin.

*   **JSON**: This is the most common and straightforward format for integration. `pycg` and `jarviscg` both output call graphs directly as JSON. A custom `tree-sitter`-based extractor would also most easily produce a custom JSON schema. For a TypeScript plugin, consuming JSON is trivial, requiring only `JSON.parse()` and mapping the data to internal structures. This makes `pycg` and `jarviscg` very easy to integrate from a data-format perspective.

*   **SCIP (Source Code Indexing Protocol)**: `scip-python` produces its index in the SCIP format, which is a binary format based on Protobuf. This is a highly structured and language-agnostic format designed for rich code intelligence. Integration into a TypeScript plugin is of 'moderate' complexity. It requires using the SCIP Protobuf schema to generate TypeScript bindings and then parsing the binary `.scip` files. An alternative, simpler path is to use the `scip` CLI to convert the index into a JSON snapshot, which can then be parsed, though this adds an extra step to the processing pipeline.

*   **DOT (Graphviz)**: `pyan3` and `PyCG` can both emit graphs in the DOT language. While excellent for visualization using Graphviz, DOT is a text-based format that is less ideal for programmatic consumption compared to JSON. A TypeScript plugin would need a DOT parser library to convert the graph into a usable data structure, adding a dependency and processing overhead.

*   **Plain Edges / Custom Text**: `pyan3` can also output plain text lists of edges. Like DOT, this requires custom parsing logic in the TypeScript plugin to reconstruct the graph, making it less convenient than JSON.

*   **LSP Responses**: Language servers like `pyright` and `pylsp` emit data via standard LSP JSON-RPC messages (e.g., for `textDocument/definition` and `textDocument/references`). To build a call graph, the plugin would need to act as an LSP client, make requests, and then assemble the graph from the responses. This requires implementing an LSP client and logic to translate symbol references into call edges. The complexity is moderate, though standardized.

In summary, tools emitting JSON (`jarviscg`, `pycg`) offer the lowest integration friction for a TypeScript plugin. SCIP (`scip-python`) provides a more powerful, standardized format at the cost of moderate integration complexity. Formats like DOT and plain text (`pyan3`) are less suitable for direct consumption and require additional parsing.

# Licensing Implications Summary

The licensing models of the evaluated tools are a critical factor for redistribution within a commercial, proprietary product. The majority of the tools use permissive licenses, but there is one significant exception.

*   **Permissive Licenses (MIT, Apache 2.0)**: Most of the modern and actively maintained tools are suitable for commercial use. This includes:
    *   **scip-python**: Apache 2.0 license.
    *   **pycg**: Apache 2.0 license.
    *   **tree-sitter-python**: MIT license.
    *   **Type Checkers**: `mypy` (MIT), `pyre` (MIT), and `pytype` (Apache 2.0) are all permissively licensed.
    *   **LSP Servers**: `pyright` (MIT), `python-lsp-server` (MIT), `jedi-language-server` (MIT), and `ruff-lsp` (MIT) all use the permissive MIT license.
    These licenses (MIT and Apache 2.0) allow the tools to be bundled, modified, and redistributed as part of a closed-source commercial product, provided that the original copyright and license notices are included. This makes them low-risk choices from a legal perspective.

*   **Copyleft License (GPL-2.0)**: The `pyan3` tool stands out with its GPL-2.0 license. This is a strong copyleft license that has significant implications for a proprietary product. If `pyan3`'s code is linked against or distributed as part of the product, it would likely require the proprietary product's source code to also be made available under the GPL. This makes `pyan3` unsuitable for bundling or direct integration into a closed-source commercial plugin. The safest way to use a GPL-licensed tool would be to invoke it as a separate command-line process, ensuring no code is shared or linked, but this approach should be carefully reviewed by legal counsel.

*   **Unknown/Unspecified**: The license for `jarviscg` was not explicitly stated in the provided context. Given its recommendation and selection by Nuanced for a commercial context, it is likely under a permissive license, but this would need to be verified before use.

In conclusion, with the exception of `pyan3`, the ecosystem of Python code analysis tools is overwhelmingly licensed under permissive terms (MIT, Apache 2.0), which is favorable for integration into a commercial product.

# Maintenance And Activity Comparison 2024 2026

The maintenance status and development velocity between 2024 and 2026 vary significantly across the tools, indicating which projects are actively evolving and which are dormant.

*   **Actively Maintained**: A large portion of the ecosystem shows strong, ongoing development.
    *   **scip-python**: As a Sourcegraph-backed project, it has active development with frequent commits and releases throughout the 2024-2026 period, ensuring it stays current with both the SCIP protocol and Python language changes.
    *   **LSP Servers (pyright, pylsp, jedi, ruff-lsp)**: All the major LSP servers are actively maintained. `pyright` and `ruff-lsp` show particularly high velocity, driven by Microsoft and Astral, respectively. `pylsp` and `jedi-language-server` also show steady commits and releases, maintaining compatibility and adding features.
    *   **Type Checkers (pytype, pyre, mypy)**: These foundational tools are backed by major corporations (Google, Meta, Dropbox/community) and have robust, continuous development activity.
    *   **tree-sitter-python**: The underlying grammar for a custom extractor is actively maintained to keep up with new Python syntax.

*   **Revived**: 
    *   **pyan3**: Contrary to older information, the `Technologicat/pyan` repository, which is the successor to the original, was actively revived in February 2026. It has been modernized to support Python 3.10-3.14 and had a new release (v2.4.0) in April 2026. This indicates a renewed maintenance effort.

*   **Production Validated / Stable**:
    *   **Jarvis (`jarviscg`)**: While its public commit velocity is noted as continuing through 2025, its most important maintenance signal is its adoption and validation by Nuanced. A Nuanced blog post from April 2026 reaffirmed it as their production extractor, suggesting it is stable and fit for purpose, even if public development is not as rapid as other tools.

*   **Inactive / Archived**:
    *   **pycg**: This academic tool is effectively unmaintained. The official repository was archived by its owner in November 2023 and is now read-only. There have been no upstream commits or releases in the 2024-2026 timeframe, making it a risky choice for a production system that needs to support modern Python features and receive bug fixes.
