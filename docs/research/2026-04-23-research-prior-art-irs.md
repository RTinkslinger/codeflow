# Executive Summary

Based on a comprehensive review of prior-art data models for code intelligence, the recommended approach for designing a v1 Intermediate Representation (IR) for the Claude Code plugin is to adopt a hybrid model with SCIP (Sourcegraph Code Intelligence Protocol) as its core. The v1 IR should be built on a versioned Protobuf schema, directly borrowing SCIP's concepts of Documents, Occurrences, and Symbols, and most critically, its `Symbol.Descriptor` grammar (`scheme.manager.package.descriptor`) for stable, language-agnostic node identity. This provides a compact, streamable, and performant backbone proven in production at Sourcegraph. To ensure seamless editor integration and a familiar user experience, the IR should align its symbol classification with the LSP `SymbolKind` enum and adopt LSP's `Range` and `selectionRange` semantics. For robust cross-repository identity, the principles of Kythe's VName structure should inform the construction of symbol descriptors. Finally, to support code visualization, the IR should include a dedicated schema layer that adopts a minimal, canonical subset of Graphviz/DOT attributes (e.g., `label`, `shape`, `color`), which can be losslessly translated to renderers like Mermaid and D2. Technologies like LSIF and tree-sitter-stack-graphs are considered less suitable for a new 2026 IR due to being superseded or having an uncertain maintenance status.

# V1 Ir Borrowing Recommendations

For the v1 IR design, it is recommended to borrow directly from the following prior-art schemas and concepts:

1.  **SCIP (Sourcegraph Code Intelligence Protocol):** The v1 IR should be fundamentally based on SCIP. This includes:
    *   **Serialization and Schema:** Adopt Protobuf for serialization and model the core schema around SCIP's `scip.proto`, including `Document`, `Occurrence`, `Symbol`, and `Relationship` messages. This provides compactness, type safety, and a streaming-friendly design.
    *   **Node Identity:** Use the `Symbol.Descriptor` string format (`scheme.manager.package.descriptor`) as the primary mechanism for symbol identification. This provides stable, human-readable, and language-agnostic IDs.
    *   **Versioning:** Follow SCIP's discipline of versioning the Protobuf schema to manage evolution and compatibility.

2.  **LSP (Language Server Protocol):** To ensure maximum compatibility with editors and IDEs, the IR should align with and incorporate key LSP structures:
    *   **Symbol Classification:** Adopt the numeric `SymbolKind` enum for classifying symbols (e.g., Class, Method, Function). This allows for direct mapping to UI icons and outline views.
    *   **Source Location:** Use LSP's `Range` and `selectionRange` structures and their zero-based, end-exclusive coordinate semantics for specifying symbol locations. This prevents off-by-one errors and simplifies adapter code.
    *   **Data Structures:** The IR's representation of symbol hierarchies should be easily convertible to LSP's `DocumentSymbol` and `CallHierarchyItem` interfaces.

3.  **Kythe:** While not adopting the entire Kythe system, the v1 IR should borrow its core principles for identity management:
    *   **VName Philosophy:** The design of the IR's symbol identifiers should be informed by Kythe's VName components (`corpus`, `root`, `path`, `language`, `signature`). This means formally separating the identity of a symbol from its physical location or repository, which is crucial for achieving robust cross-repository code intelligence.
    *   **Facts vs. Edges:** Adopt the conceptual distinction between 'facts' (metadata attached to a node) and 'edges' (typed relationships between nodes). This leads to a more flexible and queryable graph structure.

4.  **Graphviz/DOT:** For visualization purposes, the IR should define a specific visualization block for nodes and edges that contains a canonical subset of DOT attributes:
    *   **Attribute Subset:** Standardize on fields like `label`, `shape`, `style`, `color`, `fillcolor`, `penwidth`, and `arrowhead`. This creates a renderer-agnostic way to describe the visual appearance of the graph, enabling consistent output in DOT, Mermaid, D2, and other tools.

# Obsolete Prior Art Evaluation

Several prior-art technologies, while historically significant or useful for other purposes, are considered obsolete or not worth studying in-depth for the design of a new IR in 2026:

1.  **LSIF (Language Server Index Format):** LSIF is effectively obsolete as a primary format for new, large-scale indexing systems. Research shows that Sourcegraph, a primary user, migrated to SCIP to solve LSIF's major pain points, including verbose JSONL serialization, large index sizes (4-5x larger than SCIP), and high memory consumption during ingestion due to the need to build an in-memory ID-to-vertex map. While its core graph concepts were influential and carried into SCIP, LSIF itself has been superseded by a more performant and compact solution.

2.  **tree-sitter-stack-graphs:** This technology is not recommended for adoption due to its maintenance status and model limitations. The primary `github/stack-graphs` repository was archived in September 2025, making it a read-only project with no official ongoing maintenance or bug fixes. This poses a significant risk for a production system. Furthermore, its path-based approach to symbol resolution is more complex to serialize and less stable for cross-repository linking compared to the explicit, stable identifiers provided by SCIP and Kythe.

3.  **GitHub Semantic (Haskell-based):** This project is also archived and no longer actively maintained. While its Haskell-based approach to precise AST modeling offers academic lessons, it does not represent a viable, supported platform on which to build a new, multi-language IR in 2026.

4.  **srcML:** srcML is not obsolete for its intended purpose (source-to-source transformation and analysis preserving all text), but it is not a suitable foundation for a code intelligence graph IR. Its XML-based representation is verbose and not optimized for the kind of low-latency, compact data exchange required for LLM tool-calling. Its focus is on syntactic structure and source fidelity rather than a connected semantic graph of definitions and references across a codebase.

# Field Level Import List

## Source Technology

SCIP (Sourcegraph Code Intelligence Protocol)

## Concept To Import

Symbol.Descriptor

## Target Ir Application

To serve as the primary, unique, and stable identifier for all semantic nodes (symbols) within the v1 IR.

## Rationale

The SCIP `Symbol.Descriptor` provides a structured, human-readable, and language-agnostic format (`scheme.manager.package.descriptor`) for identifying code symbols. It is proven in production at Sourcegraph to create stable identifiers that work across repositories and commits. Adopting this structure directly provides a robust and deterministic node identity strategy, which is essential for building a reliable graph of definitions, references, and implementations. Its compactness and well-defined grammar make it ideal for an LLM-friendly IR, and it is superior to brittle, location-based identifiers (file path + range) or opaque integer IDs.


# Prior Art Technologies Analysis

## Technology Name

SCIP (Sourcegraph Code Intelligence Protocol)

## Data Model Shape

SCIP's data model is a code-intelligence graph represented as a stream of typed protobuf messages. The core message types are `Document`, `Occurrence`, `Symbol`, and `Relationship`. This streamable index format allows for incremental processing, where documents contain occurrences (symbol locations with ranges) that reference stable symbol IDs.

## Node Identity Strategy

Symbol identity is managed through a human-readable, language-agnostic string descriptor with a four-part structure: `scheme.manager.package.descriptor`. The 'scheme' identifies the language toolchain (e.g., `tsc`, `semanticdb`), 'manager' the package manager, 'package' the module path, and 'descriptor' the fully-qualified symbol signature. This structure provides stable, cross-repository identifiers when indexers adhere to consistent conventions.

## Edge Typing

Relationships between code entities are explicitly defined using typed `Relationship` messages. These messages capture various edge kinds, including definitions, references, implementations, and type definitions. Additionally, `Occurrence` messages carry roles (e.g., 'definition' vs. 'reference') to specify the nature of a symbol's appearance at a particular location in the code.

## Serialization Format

SCIP uses a binary serialization format based on a formal schema defined in a `.proto` file (scip.proto). This Protocol Buffers (protobuf) format is designed for streaming sequences of messages, resulting in compact and efficient data representation. Sourcegraph reports that SCIP indexes are approximately 4-5x smaller than their LSIF counterparts.

## Versioning Strategy

Schema evolution adheres to Protocol Buffers best practices, where new fields are added with new numeric tags to maintain backward compatibility. For integration, it is recommended to pin and vendor a specific `scip.proto` version. Sourcegraph also provides a `scip` CLI tool to convert between SCIP and LSIF, facilitating migration and ensuring compatibility during the transition period.

## Maintenance Status 2026

As of 2026, SCIP is actively maintained by Sourcegraph and is used in production to power precise code navigation across thousands of repositories. There is a mature ecosystem of official language indexers, including `scip-typescript`, `scip-java`, `scip-python`, `scip-go`, and `scip-ruby`, although the quality and maturity can vary, especially for highly dynamic languages.

## Llm Tool Calling Alignment

SCIP is highly aligned with the needs of LLM tool-calling. Its compact binary format and deterministic protobuf schema are efficient for data transfer. The human-readable symbol IDs are beneficial for prompt clarity and debugging. Furthermore, its streamable nature enables partial data fetching by symbol ID or file range, which is crucial for on-demand, low-latency tool execution.

## Technology Name

LSIF (Language Server Index Format)

## Data Model Shape

LSIF represents code as a directed labeled graph. The fundamental data model consists of vertices and edges, where vertex types include `document`, `range`, `resultSet`, `hoverResult`, and `definitionResult`, and edge types define relationships like `contains`, `item`, `next`, and `textDocument/definition`.

## Node Identity Strategy

Within a single LSIF file, every vertex is assigned a globally unique integer ID. Edges use these integer IDs to reference their source and target vertices. Code locations are represented by `range` vertices, which are anchored to a `document` vertex (identified by a URI) and store zero-based start/end positions.

## Edge Typing

Relationships are represented by `edge` objects in the JSONL stream. Each edge has a `label` string that specifies its type, such as `textDocument/definition`, `textDocument/references`, or `textDocument/hover`. This system connects ranges in the code to semantic information like definitions, references, and hover documentation via intermediate `resultSet` vertices.

## Serialization Format

LSIF uses a JSON Lines (JSONL) format, where each line in the file is a self-contained JSON object representing either a vertex or an edge. While this format is human-readable, it is known for being verbose and leading to large file sizes.

## Versioning Strategy

The schema relied on ad-hoc string labels for vertex and edge types, which made extensions error-prone and the schema rigid. The lack of a formal, easily evolvable schema was a significant pain point that influenced the design of its successor, SCIP.

## Maintenance Status 2026

By 2026, LSIF is considered largely superseded by SCIP for new, large-scale indexing efforts. While existing tooling is still functional and legacy LSIF dumps can be consumed, active development and community support have significantly diminished as the ecosystem, led by Sourcegraph, has shifted focus to SCIP.

## Llm Tool Calling Alignment

LSIF has poor alignment with modern LLM tool-calling needs. Its verbose JSONL format leads to large payloads. The data model often requires the entire graph to be loaded into memory to resolve integer-based ID references, resulting in high memory consumption and parsing costs, which is unsuitable for low-latency, on-demand queries.

## Technology Name

LSP (CallHierarchyItem/DocumentSymbol)

## Data Model Shape

LSP defines data structures for editor-centric features. `DocumentSymbol` represents a hierarchical, tree-like view of symbols within a single file, using a `children` property for nesting. `CallHierarchyItem` represents a node in a directed tree for visualizing call hierarchies (both incoming and outgoing calls). This is fundamentally a presentation-layer model, not a comprehensive graph IR.

## Node Identity Strategy

LSP does not provide a stable, global identity for symbols. Identity is contextual and brittle, typically relying on a combination of the document URI and the symbol's `Range`. For `CallHierarchyItem`, the combination of `uri` and `range` acts as a de-facto identifier for a specific call, but this is not stable across code changes.

## Edge Typing

Relationships are mostly implicit or handled by separate protocol requests. Lexical containment is represented by the `children` array in `DocumentSymbol`. Call relationships are resolved through dedicated `callHierarchy/incomingCalls` and `callHierarchy/outgoingCalls` requests, which return a list of call sites. There are no first-class, typed edge objects in the data model itself.

## Serialization Format

The data structures are typically serialized as JSON as part of the JSON-RPC messages used by the Language Server Protocol. The schemas are formally defined in the LSP specification and are available as TypeScript interfaces.

## Versioning Strategy

Versioning is tied directly to the official Language Server Protocol specification, which is versioned (e.g., 3.17). Changes to these structures are managed as part of the overall protocol evolution, ensuring that editors and language servers can negotiate a compatible version.

## Maintenance Status 2026

LSP is the de-facto industry standard for communication between editors and language servers. It is actively maintained by Microsoft and a large, vibrant open-source community, ensuring its continued relevance and support.

## Llm Tool Calling Alignment

Alignment is mixed. While reusing LSP field names and `SymbolKind` enums can maximize compatibility with editor-facing tools and reduce adapter code, the data model itself is insufficient for a robust backend IR. It lacks stable symbol IDs and rich semantic relationships, making it unsuitable for complex, cross-file code graph analysis required by advanced LLM tools.

## Technology Name

tree-sitter-stack-graphs

## Data Model Shape

The fundamental data model is a 'stack graph,' a specific type of directed graph derived from the scope-graphs framework. It consists of nodes representing definitions and references. Name resolution is performed by finding a valid path from a reference node to a definition node, governed by stack-based scoping rules.

## Node Identity Strategy

Identity is not based on a global, stable ID but is encoded implicitly through graph paths. A symbol is identified by the successful resolution of a path query from a reference to a definition. This path itself represents the resolution chain and acts as the identifier.

## Edge Typing

Edges in the graph represent scope and import relationships. The graph construction language allows for language-specific rules that create edges linking symbols, for example, from an `import` statement to the exported definitions in another file. The edges guide the path-finding algorithm for name resolution.

## Serialization Format

The generated stack graph is materialized as a custom binary index. This index is created by a Rust crate that provides a graph construction language for emitting the necessary nodes and edges based on a tree-sitter parse tree.

## Versioning Strategy

The primary repository from GitHub was archived, so versioning for the official tool is effectively frozen. Any further evolution would depend on community forks, which may have their own versioning schemes.

## Maintenance Status 2026

The official `github/stack-graphs` repository was archived in September 2025 and is now read-only. This indicates that official maintenance has ceased. While it was used for GitHub's code navigation, its current production status is unconfirmed. Community forks may exist, but official support is limited.

## Llm Tool Calling Alignment

The raw graph is complex, but the results of a path-finding query can be collapsed into a compact, LLM-friendly format that describes the source and target of a reference. This makes it feasible for use cases where the primary goal is to resolve a specific symbol. However, the lack of stable global IDs makes it less suitable for building and querying a comprehensive, multi-file code graph.

## Technology Name

Kythe

## Data Model Shape

Kythe uses a directed semantic graph model that distinguishes between nodes, facts, and edges. Nodes are typed semantic objects (e.g., `file`, `function`, `type`). Facts are key-value metadata attached to nodes (e.g., source text). Edges are typed relationships connecting nodes.

## Node Identity Strategy

Kythe employs a powerful and stable node identity strategy called VNames (Vector Names). A VName is a canonical identifier composed of five parts: `signature`, `corpus`, `root`, `path`, and `language`. The signature provides per-node uniqueness, while the other components provide context, enabling stable, cross-repository symbol linking.

## Edge Typing

Edges are first-class citizens with explicit, semantic types. The schema defines numerous edge kinds, such as `ref`, `defines/binding`, `childof`, `denotes`, `param`, and `ref/call`. This rich typing allows for precise and flexible queries about the relationships between code entities.

## Serialization Format

The primary serialization format is Protocol Buffers (protobuf), which is used for storing graph records efficiently. Kythe also defines a textual encoding for VNames as part of its URI specification, making them human-readable and shareable.

## Versioning Strategy

The schema is designed for evolution. New fact keys and edge kinds can be added following backward-compatible conventions, allowing the system to evolve without breaking existing indexers or consumers. The schema itself is well-documented.

## Maintenance Status 2026

Kythe is an open-source project originating from Google and remains actively maintained. It is used in production for large-scale, cross-repository code intelligence both within Google and by other academic and tooling projects, although its adoption is more niche compared to the LSP ecosystem.

## Llm Tool Calling Alignment

Kythe's model is well-aligned with the needs of a sophisticated code intelligence backend. The separation of identity (VName) from storage and location is a powerful concept. Protobuf serialization is compact. While the full graph can be large, the structured nature of facts and edges, combined with stable IDs, allows for efficient querying of specific subgraphs, making it suitable for targeted LLM tool calls.

## Technology Name

GitHub Semantic

## Data Model Shape

This Haskell-based toolchain focuses on generating precise Abstract Syntax Trees (ASTs), typed ASTs, and other intermediate representations like Control-Flow Graphs (CFGs). Its data model is primarily AST-annotated, emphasizing deep, language-specific semantic analysis derived from compiler frontends.

## Node Identity Strategy

Node identity is typically tied to AST node identifiers, which might be derived from a combination of file location, source span, and binding information from a typechecker. This identity is less standardized across different languages compared to Kythe's VNames and can be brittle across code changes unless careful normalization strategies are used.

## Edge Typing

Relationships are represented by the structure of the AST and CFG. Edge types include AST parent-child relationships, definition-use chains, and control-flow transitions. These are typically specific to the language frontend and compiler IR being used.

## Serialization Format

There is no single standard serialization format. Outputs can range from custom binary formats, JSON, or native Haskell serializations to exports into other formats like SCIP or LSIF.

## Versioning Strategy

Schema evolution is tightly coupled to the version of the underlying compiler or language analysis frontend. There is no independent, cross-language versioning strategy for the IR itself.

## Maintenance Status 2026

The original 'Semantic' project from GitHub is archived. While the Haskell-based approach to code analysis continues in various academic and open-source projects, its activity is mixed. There is no single, maintained, cross-language standard from this family that has achieved widespread adoption like SCIP.

## Llm Tool Calling Alignment

This approach is less suitable for a general-purpose, multi-language IR for LLM tool-calling. Its strength lies in deep, single-language analysis and transformation, but it lacks a standardized cross-repo linking strategy and a common data model, making it difficult to use for broad code intelligence tasks.

## Technology Name

srcML

## Data Model Shape

srcML uses a document-oriented, AST-annotated data model. It represents source code as an XML document that wraps syntactic constructs in XML tags (e.g., `<function>`, `<if>`, `<call>`) while preserving all original source text, including whitespace, comments, and preprocessor directives.

## Node Identity Strategy

Identity is positional and contextual, based on the file and the node's position within the XML tree (e.g., via XPath). Source file and hash attributes are recorded, making identity stable for a given file revision, but it lacks a canonical, cross-file, or cross-repository identifier like a Kythe VName.

## Edge Typing

Relationships are not represented as explicit typed edges. Instead, they are implicit in the XML structure (e.g., nesting for containment) and must be discovered by querying the XML tree, typically using XPath or XSLT.

## Serialization Format

The serialization format is XML. A project is typically represented as a srcML archive containing one or more `<unit>` elements, each corresponding to a source file.

## Versioning Strategy

The schema is XML-based and includes a `revision` attribute to track its version. Evolution follows standard XML practices like namespaces and is designed to be backward compatible.

## Maintenance Status 2026

srcML is actively maintained by its dedicated team and is widely used in academic research and for building tools that require source-to-source transformation, refactoring, or syntactic analysis where preserving original formatting and comments is critical.

## Llm Tool Calling Alignment

srcML is poorly aligned with the needs of a graph-centric LLM tool. The verbose XML format is not compact, and the lack of explicit semantic edges and stable global identifiers makes it unsuitable for cross-file code intelligence. Its primary use case is source-preserving transformation, not semantic graph querying.

## Technology Name

Graphviz DOT

## Data Model Shape

DOT is a graph description language used to specify a directed or undirected graph. Its data model consists of nodes, edges, and subgraphs, along with their attributes. It is designed purely for graph visualization, not for representing code semantics.

## Node Identity Strategy

Nodes are identified by a unique string ID or name within the scope of a single graph definition. This identity has no semantic meaning and is not stable or linkable across different graphs.

## Edge Typing

Edges connect two node IDs. Their type or meaning can be conveyed through attributes such as `label`, `color`, `style` (e.g., `dashed`), and `arrowhead`. However, these are purely for visual representation and are not part of a formal semantic typing system.

## Serialization Format

The format is a plain text (`.dot`) file with a simple, human-readable syntax for declaring nodes, edges, and their visual attributes.

## Versioning Strategy

The DOT language is extremely stable and has been the de-facto standard for many years. The Graphviz project that maintains it ensures backward compatibility, with new attributes being added over time without breaking existing renderers.

## Maintenance Status 2026

Graphviz and the DOT format are actively maintained and remain the standard tools for programmatic graph visualization across a wide range of applications.

## Llm Tool Calling Alignment

DOT is not a code intelligence IR, but its attribute vocabulary is highly relevant. Adopting a subset of its stable and widely supported attribute names (e.g., `label`, `shape`, `style`, `color`) within a semantic IR provides a standardized, LLM-friendly way to specify visualization intent that can be easily translated to DOT, Mermaid, or other rendering engines.

## Technology Name

Mermaid/D2

## Data Model Shape

Like DOT, Mermaid and D2 are graph description languages with an underlying data model of nodes, edges, and their styling properties. They parse a markdown-like text syntax into an internal Abstract Syntax Tree (AST) that represents the diagram's structure, which is then used by a renderer.

## Node Identity Strategy

Nodes are identified by a string ID. This ID is used to define edges and apply styles. The identity is local to the diagram and has no external semantic meaning.

## Edge Typing

Relationships are defined by drawing connections between node IDs. The type of relationship is visually represented through different arrow syntaxes (e.g., `-->` for a solid line, `-.->` for a dashed line) and by adding text labels to the edges.

## Serialization Format

The serialization format is a plain text, markdown-like syntax that is designed to be easy to write and read directly within documentation files.

## Versioning Strategy

Both Mermaid and D2 are actively developed projects with evolving syntax and features. Their versioning is managed by their respective development teams. D2, in particular, has a well-documented model.

## Maintenance Status 2026

Both technologies are actively maintained and are very popular for embedding diagrams in documentation, wikis, and web pages.

## Llm Tool Calling Alignment

These languages are excellently aligned for LLM tool-calling specifically for the task of generating diagrams. Their simple, text-based syntax is easy for an LLM to produce. The lesson for a code IR is not to use them as the primary model, but to ensure the IR contains a visualization layer that can be losslessly serialized into Mermaid or D2 syntax.

## Technology Name

Nuanced post-mortem

## Data Model Shape

This is not a technology but a blog post analyzing several tools for generating a Python call graph. The analysis led to the choice of a tool named JARVIS, which emphasizes scalable, demand-driven call-graph generation. The key data model shape is a function call graph, enriched with detailed symbol information.

## Node Identity Strategy

The post-mortem and the derived lessons highlight the critical importance of stable identifiers. The concrete recommendation is to adopt a strategy similar to SCIP's Symbol Descriptors or Kythe's VNames to enable deterministic lookups and stable linking across different versions of the code.

## Edge Typing

The analysis focuses on call graphs, so the primary edge type is the 'call' relationship. The derived recommendation for a general IR is to explicitly capture `CALL`, `REFERENCE`, and `INHERIT` edges, and to prioritize demand-driven generation of these edges for performance.

## Serialization Format

The analysis doesn't specify a format for JARVIS, but the key lesson derived for a new IR is to adopt a versioned, binary format like Protocol Buffers (inspired by SCIP) for compactness and performance.

## Versioning Strategy

The recommendation derived from the analysis is to use a formally versioned schema, such as one defined with protobuf, to ensure that the IR can evolve in a controlled and backward-compatible manner.

## Maintenance Status 2026

This is an analysis of other tools. The key takeaway is the set of evaluation criteria used: stability, practicality, performance, accuracy, and ease of integration. These criteria are timeless for evaluating engineering trade-offs in any code intelligence system.

## Llm Tool Calling Alignment

The most critical insight for LLM alignment is the emphasis on 'demand-driven generation'. This approach, which allows for the incremental streaming of graph fragments, is perfectly suited for low-latency, on-demand tool calls from an LLM, as it avoids the high upfront cost of generating a complete code graph.


# Comparison Of Data Models

The prior art in multi-language code intelligence employs several distinct data model shapes, each with specific trade-offs:

- **Graph-based Models (Kythe, LSIF):** These models represent code as a directed labeled graph. 
  - **Kythe** uses a rich semantic graph where nodes are typed semantic objects (functions, variables, types) and edges represent relationships like `ref`, `defines`, and `childof`. It further separates node metadata into 'facts' (key-value pairs), providing a flexible and powerful query model. This is ideal for deep, cross-repository semantic analysis.
  - **LSIF** also uses a directed graph, but its structure is more closely tied to LSP concepts. It consists of vertices (like `document`, `range`, `resultSet`) and edges (`contains`, `textDocument/definition`) serialized as JSON Lines. Its strength was its direct mapping to editor features, but its weakness was verbosity and the need to build a full in-memory graph for resolution, a key reason it was superseded.

- **Stream-based Graph Model (SCIP):** SCIP represents the code intelligence graph as a stream of typed Protobuf messages (`Document`, `Occurrence`, `Symbol`, `Relationship`). While it describes a graph, its serialization as a stream allows for incremental processing without holding the entire graph in memory. This combines the relational power of a graph with the performance benefits of streaming, making it highly efficient for both indexing and consumption.

- **AST-annotated Models (srcML, GitHub Semantic):** These models focus on preserving the Abstract Syntax Tree (AST) and enriching it.
  - **srcML** provides a document-oriented XML representation that wraps source code constructs in XML tags while preserving all original text, including whitespace and comments. Its strength is lossless source-to-source transformation and syntactic queries using XPath, but it's less suited for deep semantic or cross-repo linking.
  - **GitHub Semantic** (a Haskell-based approach) emphasizes creating a precise, typed AST and other intermediate representations like a Control Flow Graph (CFG). This enables fine-grained, language-aware transformations and analysis but requires a robust compiler-like frontend for each language.

- **Hierarchical and Request-based Model (LSP):** The Language Server Protocol (LSP) itself does not define a persistent, unified graph model. Instead, it provides structures for specific requests. `DocumentSymbol` creates a hierarchical tree representing the lexical structure within a single file, which is excellent for editor outlines. `CallHierarchyItem` provides nodes for a call graph, but the graph is built on-demand through successive requests. This is a lightweight, UX-focused model, not a comprehensive code graph IR.

- **Scope-Resolution Graph (tree-sitter-stack-graphs):** This model represents name resolution as a path-finding problem on a specialized directed graph. Nodes are definitions or references, and edges represent scope transitions. A path from a reference to a definition is only valid if it adheres to stack-based scoping rules. This is powerful for precise, cross-file name resolution without full program analysis but is a more specialized model than a general-purpose code graph.

# Comparison Of Node Identity Strategies

Establishing stable, cross-language node identity is a critical challenge, and different systems employ vastly different strategies:

- **SCIP's Symbol Descriptors:** SCIP uses a human-readable, structured string called a Symbol Descriptor to uniquely identify any symbol. The grammar is `scheme.manager.package.descriptor`. 
  - `scheme`: The language or toolchain (e.g., `tsc`, `semanticdb`, `pyright`).
  - `manager`: The package manager (e.g., `npm`, `maven`).
  - `package`: The package name and version.
  - `descriptor`: A language-specific, fully-qualified path to the symbol (e.g., `Class#method(paramTypes)`).
  This approach creates stable, language-agnostic identifiers that are consistent across repositories and indexing runs, provided indexers follow consistent conventions. Its human-readability is also a benefit for debugging.

- **Kythe's VNames (Vector Names):** Kythe uses a canonical identifier called a VName, which is a composite structure designed for maximum stability and context-awareness. A VName consists of: `{signature, corpus, root, path, language}`.
  - `signature`: A unique identifier for the node itself, often a structural hash or lexical signature.
  - `corpus`: The logical repository or collection of source code.
  - `root` and `path`: Isolate the location within the corpus.
  - `language`: The source language.
  The key innovation is separating the node's intrinsic identity (`signature`) from its location (`corpus`, `path`). This makes VNames extremely stable and ideal for cross-repository, cross-version linking at scale.

- **LSP's Range-Based Identity:** The Language Server Protocol (LSP) does not have a concept of a stable, global symbol identifier. Identity is typically contextual and transient. For features like `CallHierarchyItem`, a symbol is identified by its `DocumentUri` and `selectionRange` (the start/end position of its name in the file). This is inherently brittle; any code change that shifts line or character numbers can break the identity. It is sufficient for real-time editor interactions but unsuitable for a persistent, queryable code graph.

- **LSIF's Localized IDs:** The Language Server Index Format (LSIF) assigns a unique integer ID to every vertex within a single index file. However, this ID has no meaning outside of that specific file. It is not stable across different indexing runs or files, making it impossible to use for cross-index linking.

- **Implicit and Positional Identity (tree-sitter-stack-graphs, srcML):**
  - **tree-sitter-stack-graphs** does not use explicit global IDs. A symbol's identity is implicitly defined by the valid graph path from a reference to its definition. This is a powerful concept for resolution but doesn't provide a simple, serializable identifier for a node.
  - **srcML** identity is positional and contextual, based on the file and the symbol's location within the XML document tree (e.g., via XPath). This is stable for a given file revision but lacks a standard cross-file or cross-repository canonical identifier.

# Comparison Of Edge Typing And Relationships

The representation of relationships (edges) between code entities (nodes) varies significantly, ranging from rich, explicit typing to implicit or request-based connections.

- **SCIP:** Relationships are modeled explicitly through `Relationship` messages that link two symbols. These messages are typed to represent concepts like `implements`, `overrides`, and `type_definition`. Additionally, each `Occurrence` (an instance of a symbol in the code) has a `symbol_roles` field that specifies if it's a `definition` or a `reference`. This dual approach provides both high-level symbol-to-symbol relationships and fine-grained information at each point of use.

- **LSIF:** LSIF uses explicit, string-labeled edges to connect its vertices. The schema defines a set of labels for common code intelligence concepts, such as:
  - `contains`: Links a document to the ranges within it.
  - `item`: Connects ranges to result sets, acting as an indirection.
  - `textDocument/definition`: Links a reference result to its definition result.
  - `textDocument/references`: Links a definition to its references.
  - `textDocument/hover`: Links a range to its hover information.
  This system is explicit but was criticized for its complexity and the indirection introduced by `resultSet` vertices, which SCIP simplified.

- **Kythe:** Kythe has one of the most expressive systems for edge typing. It makes a clear distinction between 'facts' (properties of a node) and 'edges' (relationships between nodes). Edges have well-defined kinds with specific semantics, including:
  - `defines/binding`: Connects an anchor (a span of text) to the semantic node it defines.
  - `ref`: Connects an anchor to the semantic node it references.
  - `childof`: Represents lexical or syntactic containment.
  - `param`: Links a function to its parameters.
  - `imputes`: Represents implementation or inheritance relationships.
  This rich, explicit vocabulary allows for powerful and precise semantic queries on the code graph.

- **LSP:** In the Language Server Protocol, relationships are often less explicit within a single data structure. The `DocumentSymbol` structure has a `children` property, which represents direct lexical containment (e.g., a method inside a class). However, other critical relationships like 'calls' or 'implements' are not represented as simple edges. Instead, they are resolved through dedicated requests like `textDocument/references`, `textDocument/implementation`, and the `callHierarchy/*` family of requests. The protocol is designed around user actions rather than representing a complete, static graph.

# Comparison Of Serialization And Versioning

The choice of serialization format and versioning strategy has significant implications for performance, size, and long-term maintainability. The systems analyzed show a clear trend away from text-based formats toward binary, schema-defined formats.

- **SCIP:**
  - **Serialization:** Uses **Protobuf (binary)**. The index is a stream of `Index` messages, each containing documents, symbols, and relationships. This format is extremely compact and performant to parse. Sourcegraph reports SCIP indexes are 4-5x smaller than their LSIF equivalents.
  - **Versioning:** The schema is defined in a versioned `.proto` file (`scip.proto`). Schema evolution follows standard Protobuf best practices, such as using new numeric tags for new fields, which ensures backward and forward compatibility. This provides a disciplined and robust approach to evolving the format.

- **LSIF:**
  - **Serialization:** Uses **JSON Lines (JSONL)**, a text-based format where each line is a separate JSON object representing a vertex or an edge. While human-readable, this format is verbose and slow to parse. The large size and high memory cost of parsing were major pain points.
  - **Versioning:** LSIF's schema was defined by a specification, but extensions often relied on ad-hoc string labels for vertices and edges. This made schema evolution rigid and error-prone, as consumers had to handle a variety of potentially undocumented labels.

- **Kythe:**
  - **Serialization:** Primarily uses **Protobuf**, similar to SCIP, for storing graph records (facts and edges) efficiently. It also defines a stable textual encoding for its VName identifiers, known as Kythe URIs, for use in other contexts.
  - **Versioning:** Like SCIP, it benefits from Protobuf's disciplined schema evolution capabilities. The overall Kythe schema is documented and designed to be extensible by adding new fact and edge kinds in a backward-compatible manner.

- **srcML:**
  - **Serialization:** Uses **XML**. An entire project can be serialized into a single `srcml` archive containing multiple `<unit>` elements, one per source file. XML is text-based, standardized, and benefits from a vast ecosystem of tools (like XPath/XSLT), but it is notoriously verbose.
  - **Versioning:** The schema is versioned using attributes within the XML itself (e.g., `srcML_revision`). Evolution follows standard XML practices like namespaces and version attributes.

- **tree-sitter-stack-graphs:**
  - **Serialization:** Uses a **custom binary index format** generated by the core Rust crate. This format is optimized for the internal path-finding query engine but is not a standardized or public format intended for general-purpose data exchange.

# Comparison Of Maintenance And Ecosystem Status

As of 2026, the maintenance status and ecosystem maturity of these technologies vary widely, indicating clear winners and losers in the race for a standard code intelligence format.

- **Actively Maintained & Production-Used:**
  - **SCIP:** Actively maintained and developed by Sourcegraph, where it is used in production to power precise code navigation for thousands of repositories. It has a growing ecosystem of official and community-maintained indexers for major languages like TypeScript/JavaScript, Java/Scala/Kotlin, Python, Go, and Ruby. It is the clear successor to LSIF.
  - **LSP:** As a core protocol for developer tooling, LSP is actively maintained by Microsoft and a broad community. It is ubiquitously supported across all major editors and IDEs.
  - **Kythe:** The open-source project remains actively maintained. While its primary user is Google, it sees adoption in other large-scale, cross-repository code analysis efforts, particularly in academic and specialized tooling projects. Its adoption is considered niche compared to the LSP/SCIP ecosystem.
  - **srcML:** The project is actively maintained by its dedicated team and is widely used within the academic research community for source code analysis and transformation tasks.

- **Archived or Legacy Status:**
  - **LSIF:** While existing LSIF indexers and dumps are still functional, the format is considered legacy. Sourcegraph and the wider ecosystem have largely moved to SCIP for new development. Active maintenance on LSIF tooling has significantly tapered off.
  - **tree-sitter-stack-graphs:** The primary repository, `github/stack-graphs`, was archived in September 2025 and is now read-only. This indicates that official maintenance has ceased. While it may have seen experimental or legacy use at GitHub, it is no longer an actively developed official project. Community forks may exist, but its future is uncertain.
  - **GitHub Semantic:** This Haskell-based project is also archived and not actively maintained. Its value lies in the data model lessons it provides rather than as a viable, maintained tool in 2026.

- **Niche or Specialized Adoption:**
  - **JARVIS:** Highlighted in a 2023 post-mortem by Nuanced as their chosen tool for Python call graph generation, suggesting it is a mature and practical tool for its specific domain. Its broader ecosystem status is less clear.

# Analysis Of Llm Tool Calling Alignment

Evaluating the data models against the requirements of 2026-era LLM tool-calling—which prioritizes compactness, determinism, low latency, and streamability—reveals clear suitability tiers.

- **Excellent Alignment:**
  - **SCIP:** SCIP is exceptionally well-aligned. Its Protobuf serialization results in a compact binary format that is fast to transfer and parse. The streamable design allows an LLM tool to process data incrementally or fetch partial information (e.g., for a single file or symbol) without downloading an entire index. The deterministic and human-readable `Symbol.Descriptor` IDs are ideal for inclusion in prompts and for ensuring repeatable tool calls.
  - **Kythe:** Kythe shares many of SCIP's advantages. Its use of Protobuf ensures compactness and performance, while the stable VName identifiers provide the determinism needed for reliable tool calls. The separation of facts and edges allows for highly specific and flexible queries, enabling a tool to fetch only the precise information an LLM needs.
  - **JARVIS:** As highlighted by Nuanced's analysis, a demand-driven generation model like JARVIS is highly suitable. Instead of consuming a massive, pre-computed index, the tool can request a specific call graph fragment on the fly, minimizing latency and data transfer, which is a perfect fit for the interactive nature of LLM tool-calling.

- **Good Alignment (with Adapters):**
  - **LSP Data Structures:** While the LSP protocol itself is chatty, the core data structures like `DocumentSymbol` and `CallHierarchyItem` are JSON-serializable, relatively compact, and well-understood. They can be used directly in LLM tool outputs for editor-centric tasks. The main drawback is the lack of stable IDs, which would need to be added by an intermediate IR.

- **Poor Alignment:**
  - **LSIF:** LSIF is poorly aligned with modern LLM needs. Its verbose JSONL format leads to large file sizes and slow parsing. The need to build an in-memory map of IDs to resolve the graph makes it unsuitable for low-latency, partial data retrieval. Its pain points are directly at odds with the requirements for efficient tool-calling.
  - **srcML:** The XML-based format of srcML is extremely verbose and not designed for compact data exchange. While powerful for source-to-source transformation, it is a poor choice for feeding concise, semantic information to an LLM.
  - **tree-sitter-stack-graphs:** While the underlying graph is complex, the final path-finding *result* can be collapsed into a compact format (e.g., source and target locations). However, using the full graph model directly in a tool call would be inefficient. It is better suited as an engine whose *output* is adapted for the LLM.

# Scip Protocol Deep Dive

## Data Model Shape

SCIP (Sourcegraph Code Intelligence Protocol) is a protobuf-based indexed format that models a code-intelligence graph as a stream of typed messages. Its core data model consists of four primary message types: `Document`, `Occurrence`, `Symbol`, and `Relationship`. A `Document` message represents a source file and contains a collection of `Occurrence` messages. Each `Occurrence` signifies a specific range of code within the document where a symbol appears, and it can be associated with supplementary data like hover text. Occurrences are linked to a `Symbol` via a human-readable string ID. This entire index is designed to be streamable, enabling consumers to process the data incrementally, which significantly lowers memory requirements compared to models that necessitate loading the entire graph into memory at once.

## Node Identity Strategy

SCIP establishes stable, language-agnostic node identity through a structured `Symbol.Descriptor`. This descriptor is a qualified identifier following a four-part grammar: `scheme.manager.package.descriptor`. The `scheme` identifies the language or toolchain (e.g., `tsc` for TypeScript, `semanticdb` or `jvm` for Java). The `manager` specifies the build system or package manager. The `package` component provides the module or package path. Finally, the `descriptor` is a fully-qualified signature for the symbol within its package. This structure yields stable identifiers that can be consistent across different repositories. For example, a TypeScript method might have the ID `tsc:typescript:src/foo:Class#method(paramTypes)`, while a Java method could be `semanticdb:jvm:com.example.pkg:MyClass.method(Ljava/lang/String;)V`. While effective for statically typed languages, achieving stability for dynamic languages like Python (`pyright:python:my_pkg.module:MyClass.my_method`) is more challenging and depends on strict adherence to indexing conventions to prevent ID instability from dynamic language features.

## Edge Typing And Relationships

In SCIP, the relationships between symbols are explicitly defined using typed `Relationship` messages, which serve as the directed edges of the code graph. The protocol defines various kinds of relationships to capture rich semantic connections, including definitions, references, implementations, and type definitions. In addition to these explicit symbol-to-symbol edges, each `Occurrence` message contains a `role` field (e.g., 'definition' or 'reference'). This role specifies the nature of the symbol's appearance at that particular code location. This dual system of explicit `Relationship` messages and role-annotated `Occurrence` messages provides the comprehensive data needed to power code intelligence features like 'find all references', 'go to implementation', and displaying detailed hover documentation, which can be attached to either `SymbolInformation` or `Occurrence` entries.

## Serialization And Versioning

SCIP utilizes Protocol Buffers (protobuf) for its serialization format, which results in a compact and efficient binary representation. The canonical schema is defined in the `scip.proto` file. A key design feature is its streamability, allowing a sequence of SCIP messages to be processed serially, which avoids the high memory overhead of in-memory graph construction. The protocol's versioning and evolution strategy follows protobuf best practices: new fields can be added with unique numeric tags while preserving existing ones, ensuring backward compatibility. To support migration from its predecessor, Sourcegraph provides the `scip` command-line tool, which includes functionality to convert LSIF indexes to the SCIP format, ensuring a smooth transition and continued support for legacy data.

## Tooling Ecosystem Maturity

The SCIP ecosystem is actively maintained by its creator, Sourcegraph, and includes a suite of official indexers for various languages. The most mature indexers include `scip-typescript` for TypeScript and JavaScript, which is considered production-grade, and `scip-java`, which leverages compiler plugins to support Java, Scala, and Kotlin. Other indexers like `scip-python` (a fork of Pyright), `scip-go`, and `scip-ruby` are also available, though their maturity levels vary, with some being community-maintained. The core `scip` repository provides essential development tools, including test utilities and snapshot harnesses, to help ensure the quality and consistency of indexers. While coverage for major languages is strong, gaps may exist for less common or highly dynamic languages.

## Production Usage And Performance

SCIP is battle-tested and used in production at scale by Sourcegraph to power its precise code navigation features across thousands of public and private repositories. The company successfully migrated its primary code intelligence indexing pipeline for major languages like TypeScript and Java from the older LSIF format to SCIP. This transition yielded substantial performance and efficiency improvements. Based on metrics reported by Sourcegraph, SCIP indexes are significantly smaller than their LSIF counterparts—approximately 4 times smaller when gzipped and 5 times smaller uncompressed. Furthermore, the runtime of indexers improved dramatically; for example, the `scip-typescript` indexer was reported to be about 10 times faster than the previous `lsif-node` indexer.


# Lsif To Scip Migration Lessons

## Lsif Data Model

The Language Server Index Format (LSIF) defines a code graph using a directed labeled graph model, which is serialized as newline-delimited JSON (JSONL). In this format, each line represents either a `vertex` or an `edge`. The schema defines several vertex types, including `document` (for source files), `range` (for a span of text), `resultSet` (a container for query results), `definitionResult`, `referenceResult`, `hoverResult`, `moniker`, and `packageInformation`. These vertices are connected by typed edges like `contains` (e.g., a document contains ranges), `item` (linking a range to a resultSet), `next` (linking result sets), and edges corresponding to LSP requests like `textDocument/definition`. Each vertex within an LSIF dump is assigned a unique integer ID, which edges use to reference their source and target vertices, thereby constructing the graph.

## Key Pain Points

LSIF had several significant drawbacks that ultimately led to its replacement by SCIP. The primary issues were related to performance and efficiency. Its verbose JSONL serialization resulted in extremely large index files with considerable data redundancy. Processing these files was resource-intensive, as consumers often needed to load the entire graph structure into memory to resolve all the integer-based ID references, leading to high memory consumption. The schema itself was also a source of problems; it relied on string-based labels for types, which made extending the schema in a safe, backward-compatible way difficult and error-prone. Finally, the model's complexity, especially the indirection required through `resultSet` vertices, made it challenging for tool authors to produce correct and bug-free LSIF indexers.

## Concepts Retained In Scip

Although SCIP was designed to overcome LSIF's limitations, it retained several of its predecessor's valuable core concepts. The fundamental abstraction of modeling code intelligence as a graph composed of symbols, their occurrences in documents, and the relationships between them was carried forward directly into SCIP's design. SCIP also adopted and refined LSIF's concept of 'monikers' (represented by `moniker` and `packageInformation` vertices in LSIF) as a mechanism for identifying symbols that are defined in external packages, which is crucial for enabling cross-repository code navigation. The central idea of associating definitions, references, and hover documentation with specific symbol occurrences was also a key feature of LSIF that influenced SCIP's structure.

## Lessons For New Ir Design

The evolution from LSIF to SCIP offers critical lessons for anyone designing a new intermediate representation for code intelligence. A primary lesson is to use a strongly typed and versioned schema, such as one defined with Protocol Buffers, to prevent the ambiguity and rigidity of string-based types. Secondly, a compact binary serialization format is preferable to text-based formats like JSONL to minimize file size and parsing overhead. The design should also be streaming-friendly, allowing consumers to process data incrementally without holding the entire graph in memory. To reduce redundancy, the IR should include primitives for deduplication, such as a shared string table. Finally, providing robust official tooling, including emitter libraries, validators, and clear versioning/migration strategies, is essential to lower the barrier for producers and ensure the long-term health of the ecosystem.


# Lsp Schema Alignment Guidelines

## Typescript Schema Summary

The Language Server Protocol (LSP) specification provides precise, TypeScript-friendly schemas for representing code symbols. The `DocumentSymbol` interface is used for hierarchical document outlines and includes fields such as `name: string`, `detail?: string`, `kind: SymbolKind` (a numeric enum), `range: Range` (the full span of the symbol), `selectionRange: Range` (the span of the symbol's identifier), and an optional `children?: DocumentSymbol[]` for nesting. The `CallHierarchyItem` is similar but used for call graphs, containing `name`, `kind`, `uri: DocumentUri`, `range`, and `selectionRange`. The `SymbolKind` enum provides a language-agnostic classification of symbols with numeric values like `Class = 5`, `Method = 6`, `Function = 12`, and `Variable = 13`. Positional information is defined using `Position` ({ line, character }) and `Range` ({ start, end }) interfaces, which are zero-based with an exclusive end position.

## Editor Rendering Behavior

Editors and IDEs like VS Code heavily rely on LSP data structures to render user-facing code intelligence features. The hierarchical nature of the `DocumentSymbol` structure, with its `children` property, is directly used to populate UI elements like the 'Outline' view, document breadcrumbs, and symbol search palettes. Editors use the `kind` property to display appropriate icons next to symbol names, `selectionRange` to highlight the identifier when a symbol is selected, and the `deprecated` flag to apply strikethrough styling. Similarly, the `CallHierarchyItem` is the fundamental building block for the Call Hierarchy view. The editor renders a tree of incoming or outgoing calls, where each node is a `CallHierarchyItem`, and uses the `uri` and `range` fields to enable navigation to the source code of the caller or callee upon user interaction.

## Ir Alignment Recommendations

For a new IR to achieve maximum compatibility with the existing ecosystem of editors and plugins, it is highly recommended to align its field names and enums with the LSP specification where it makes sense. The IR should include fields with names and types that map directly to LSP's `DocumentSymbol`, such as `name`, `detail`, `kind`, `deprecated`, `range`, and `selectionRange`. It should also adopt the numeric values of the `SymbolKind` enum for its own `kind` field. However, to overcome LSP's limitations for a persistent code graph, the IR must be extended. The most critical extension is the addition of a stable, globally unique identifier (e.g., `uid: string`) for each symbol, as LSP lacks this concept. Other recommended extensions include fields for language-specific kinds (`langKind: string`), support for symbols with multiple non-contiguous ranges (`ranges: Range[]`), and an explicit semantic parent link (`containerUid: string`) to distinguish from purely lexical containment.

## Naming And Extension Tradeoffs

There is a clear trade-off between strictly reusing LSP names and extending an IR with custom fields. The primary advantage of reusing LSP names and enums is immediate interoperability; it minimizes the amount of adapter code required for an editor plugin to consume the IR and translate it into native LSP types that the editor understands. This accelerates integration. The main disadvantage is that LSP's data model is optimized for real-time editor UX, not for the rich semantics of a comprehensive code graph. It lacks stable identifiers, which makes representing graph edges brittle. Conflating the IR's schema with LSP's can force a compromise on semantic precision. Therefore, the best strategy is a hybrid approach: reuse LSP names for presentation-layer fields (`name`, `kind`, `range`) to simplify editor integration, but extend the IR with new, unambiguously named fields (`uid`, `semanticRoles`, `containerUid`) to capture the deeper graph semantics that LSP omits.


# Visualization Model Alignment Recommendations

## Recommended Dot Attribute Subset

To ensure predictable rendering, the IR should adopt a verbatim subset of canonical, stable, and widely supported Graphviz DOT attributes. This subset includes: `id`/`name`, `label`, `shape`, `style`, `color` (for stroke), `fillcolor`, `penwidth`, `fontsize`, `fontname`, `fontcolor`, `width`, `height`, `margin`, `tooltip`, `URL`, `arrowhead`, `arrowtail`, `dir`, and `weight`. Recommended defaults should be established, such as `shape: 'box'`, `style: 'filled'`, `penwidth: 1`, and `arrowhead: 'normal'`, to handle cases where attributes are not explicitly provided.

## Mermaid Mapping Guidelines

To map the IR's properties to Mermaid's internal Abstract Syntax Tree (AST) for rendering, the following guidelines should be followed:
1.  **Node Mapping**: An IR node should be mapped to a Mermaid node object containing `{ id, text, classes, style }`. The IR's `id` and `label` fields map directly to Mermaid's `id` and `text`. The IR's `shape` attribute should be mapped to the closest corresponding Mermaid shape (e.g., IR 'box' becomes Mermaid 'rect').
2.  **Edge Mapping**: An IR edge maps to a Mermaid edge object `{ from, to, label, arrow, style, classes }`. The IR's `arrowhead` and `arrowtail` properties should be used to select the appropriate Mermaid arrow syntax (e.g., `->`, `-->`, `o->`).
3.  **Styling**: The IR's styling attributes like `fillColor`, `strokeColor`, and `strokeWidth` should be translated into Mermaid classes or inline style strings to control visual appearance.

## D2 Model Mapping Guidelines

To map the IR's properties to the documented model of the D2 diagramming language, the following guidelines are recommended:
1.  **Node Mapping**: An IR node corresponds to a D2 node object `{ id, label, shape, style, fill, stroke, strokeWidth, icon, classes, attrs }`. The IR's shared visualization fields should be aligned directly with these D2 keys.
2.  **Edge Mapping**: An IR edge maps to a D2 edge object `{ from, to, label, style, arrow, weight, penwidth, color, classes, attrs }`. The IR's `strokeWidth` maps to D2's `strokeWidth` (and DOT's `penwidth`), and the `arrowhead` direction maps to D2's `arrow` property (e.g., `forward`, `backward`, `both`).
3.  **Themes and Quirks**: The mapping should account for D2's support for themes, which can provide default styling. It should also handle D2-specific syntax, such as requiring explicit `key` settings for shape tokens (e.g., `db.shape`).

## Shared Visualization Schema Proposal

A shared, normalized visualization schema layer should be integrated within the IR to ensure consistent rendering. This schema normalizes attributes so that different renderers can consume the same payload without lossy conversions. The proposed schema includes the following fields:
- `id` (string): Unique identifier.
- `label` (string): Human-readable text.
- `shape` (enum): A list of common shapes like `box`, `ellipse`, `diamond`, `database`, `component`.
- `style` (enum): Visual styles like `filled`, `dashed`, `rounded`, `solid`.
- `fillColor` (string): Hex color for fill.
- `strokeColor` (string): Hex color for border.
- `strokeWidth` (number): Border thickness.
- `font` (object): Contains `name`, `size`, and `color`.
- `tooltip` (string): For accessibility and hover text.
- `url` (string): A hyperlink target for interactive diagrams.
- `arrowhead` / `arrowtail` (enum): Arrow styles like `none`, `normal`, `vee`, `diamond`.
- `weight` (number): For influencing edge routing in layout algorithms.
To make this layer LLM-friendly, it should use compact representations like numeric enums, define stable token orderings, use explicit units (e.g., points for `strokeWidth`), and include a `schema_version` field.


# Key Takeaways From Nuanced Post Mortem

## Evaluation Summary

Nuanced's post-mortem evaluated several tools for generating Python function call graphs. Their own internal tooling produced an *enriched Python function call graph* via static analysis, exposed through an extended LSP 'Symbols API'. The research findings indicate that while the post-mortem discussed evaluations of `pycg`, `tree-sitter-stack-graphs`, `Glean`, `scip-python`, and `pytype`, the provided source material lacked specific comparative details on `pycg`, `Glean`, `scip-python`, and `pytype`. The analysis did conclude that `tree-sitter-stack-graphs` was not necessary for Python as their own static analysis pipeline provided richer symbol data. It also noted that `LSIF` was superseded by more performant formats like SCIP, and `srcML`'s XML output was unsuitable for low-latency LLM interactions.

## Jarvis Selection Rationale

Nuanced chose the JARVIS IR for several key reasons related to its stability, practicality, and performance, which were critical for their AI coding assistant use case. The primary factors were:
1.  **Performance and Scalability**: JARVIS is designed for high-throughput, low-latency environments, offering scalable, demand-driven call-graph generation. This on-demand approach avoids the high upfront cost of full-graph construction, aligning with the performance constraints of LLM tool-calling.
2.  **Stability and Practicality**: JARVIS was considered mature and accurate, with good CI integration, which reduced the maintenance burden and provided a stable foundation.
3.  **Alignment with IR Needs**: Its output model was found to map cleanly to LSP-style symbols and could be serialized into compact formats suitable for efficient streaming to an LLM.

## Lessons For Ir Design

The post-mortem and subsequent analysis provide several cross-cutting, actionable lessons for designing a new v1 IR:
1.  **Data Shape**: Adopt a hybrid model that combines the strengths of different systems. Specifically, use a static call-graph structure with stable identifiers like SCIP's `Symbol.Descriptor` and enrich it with dynamic, editor-friendly metadata like LSP's `SymbolKind`.
2.  **Identity Strategy**: Prioritize a stable, global identity strategy for symbols, such as SCIP's VName-like descriptors, to enable deterministic lookups across different code versions and repositories.
3.  **Edge and Serialization Strategy**: The IR should explicitly type edges (e.g., `CALL`, `REFERENCE`, `INHERIT`) and prioritize demand-driven generation of these edges for performance. For serialization, a versioned Protobuf schema (inspired by SCIP) is recommended for its compactness, determinism, and streaming capabilities.
4.  **Visualization**: Incorporate a minimal subset of DOT attributes (`label`, `shape`, `style`, `color`) directly into the IR to support standardized visualization.

## Identified Risks And Open Questions

The analysis highlighted several risks and open questions relevant to designing a new IR based on these findings:
- **Risks**: There is a risk of entity confusion between similarly named tools, which requires careful disambiguation. A significant gap is the lack of empirical performance data directly comparing JARVIS against the other alternatives, making it difficult to validate performance claims independently.
- **Open Questions**: Key unresolved questions for a new IR include how to effectively handle mixed-language projects within a single, coherent graph representation and determining the optimal granularity or chunk size for streaming graph fragments to an LLM to balance latency and context.

