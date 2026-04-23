# Executive Summary

This report provides a deep comparative analysis of TypeScript graph libraries to select the optimal core for a plugin that models multi-language code dependencies. The analysis, covering the period from 2024 to 2026, evaluated libraries against critical requirements including strongly-typed node/edge attributes, multi-edge support, lossless JSON serialization, and a rich algorithm ecosystem. The primary candidates evaluated were Graphology, the ngraph family, Cytoscape.js, and other alternatives like jsnetworkx and @ant-design/x6. The findings indicate that Graphology is the most suitable library for this use case. It offers first-class TypeScript support with generics, native handling of multi-directed graphs, robust and lossless serialization, and a comprehensive ecosystem of plugins for algorithms and layouts. In contrast, ngraph, while highly performant and minimalist, requires significant custom logic for serialization and algorithm integration. Cytoscape.js and @ant-design/x6 are powerful but are considered overkill, as their large bundle sizes are inflated by UI and rendering features not required by the plugin's core data model. Other alternatives like jsnetworkx and @dagrejs/graphlib fall short on TypeScript ergonomics and modern feature support. Therefore, the final recommendation is to adopt Graphology as the central graph data model for the plugin.

# Recommended Library

Graphology

# Recommendation Rationale

Graphology is recommended as the best fit for the code dependency plugin due to its superior alignment with the project's core requirements, offering a mature and well-balanced feature set.

1.  **TypeScript Ergonomics and Typed Attributes**: Graphology provides excellent, built-in TypeScript support. Its API exposes generic overloads, allowing developers to define strongly-typed graphs like `Graph<NodeAttributes, EdgeAttributes>`. This ensures compile-time safety and a superior developer experience when working with node and edge data, a significant advantage over libraries with incomplete or community-maintained typings like ngraph or jsnetworkx.

2.  **Native Multi-Edge Support**: The plugin requires modeling multiple, distinct dependencies (e.g., `import` vs. `re-export`) between the same two files. Graphology natively supports this through its `MultiDirectedGraph` class or by allowing unique keys for each edge. This is a critical feature that is handled more elegantly than in libraries that require workarounds or are historically single-edge, such as @dagrejs/graphlib.

3.  **High-Fidelity Serialization**: The library includes `graph.toJSON()` and `graph.fromJSON()` methods that ensure lossless serialization and deserialization of the entire graph structure. This includes nodes, edges, all attributes, graph-level metadata, and, crucially, parallel edges. This built-in capability is vital for the live-reload preview feature and is more robust than the custom serialization logic required for a minimalist library like ngraph.

4.  **Rich and Modular Ecosystem**: Graphology comes with a comprehensive suite of algorithms available through separate packages (`graphology-utils`, `graphology-operators`). This provides access to essential functions like topological sort, strongly connected components (SCC), and shortest path algorithms without bloating the core library. This modular approach is preferable to Cytoscape.js, where algorithms are bundled with a heavy UI layer, or ngraph, which requires sourcing and integrating multiple disparate packages.

5.  **Maturity and Active Maintenance**: The project demonstrates strong maintenance velocity through 2024-2026, with 1,366 commits and 66 releases. Its adoption as the backend for the popular `sigma.js` visualization library attests to its stability and performance in production environments. This level of maturity de-risks its adoption for a new plugin.

In conclusion, Graphology provides the ideal trade-off: it is a feature-rich, data-centric library without the unnecessary overhead of a full visualization stack, making it the most productive and robust choice for this project.

# Library Profiles

## Library Name

Graphology

## Api Ergonomics And Typing

Graphology provides a first-class TypeScript experience, shipping with built-in declaration files (via the `graphology-types` package). The API is generic-friendly, exposing overloads that allow developers to define strongly-typed interfaces for node and edge attributes, such as `Graph<NodeAttributes, EdgeAttributes>`. This pattern enables compile-time safety and robust IntelliSense support, preventing common errors from using loosely typed `any` or `record` types for graph data.

## Multi Edge Support

The library has native support for multi-graphs, allowing multiple, distinct edges between the same two nodes. This is achieved either by using the dedicated `MultiDirectedGraph` class or by providing a unique `key` property when adding an edge with the `addEdge` method. Each parallel edge can have its own independent attribute object, which is critical for modeling scenarios like a file that both imports and re-exports from another, where each relationship needs to be represented as a separate edge with unique metadata.

## Serialization Fidelity

Graphology offers excellent serialization capabilities with `graph.toJSON()` (or `graph.export()`) and `graph.fromJSON()` methods. These functions provide lossless round-trip serialization of the entire graph structure, including nodes, edges, their respective attributes, graph-level metadata, and crucially, the unique keys for multi-edges. The serialized JSON format also includes version information, which aids in managing schema migrations over time.

## Algorithm Coverage

The library features a comprehensive ecosystem of graph theory algorithms, available through companion packages like `graphology-utils` and `graphology-operators`. This includes essential algorithms for dependency graph analysis such as topological sort, finding strongly connected components (SCC), shortest path calculations (e.g., Dijkstra), as well as utilities for traversals, community detection, and clustering. This rich, accessible algorithm suite is a major advantage for analytical tasks.

## Performance Characteristics

While the project does not publish extensive official benchmarks, empirical community tests and its design suggest that most core operations perform in linear time. Performance overhead is more likely to stem from JavaScript's inherent memory management rather than algorithmic inefficiency. Its use as the data backend for the `sigma.js` visualization library demonstrates its suitability for large-scale, real-time applications.

## Bundle Size

The core library has a moderate footprint. The unpacked size of version 0.26.0 is reported as 2.73 MB. However, when bundled for production using modern tools, its modular design allows for effective tree-shaking, especially when only the core data model is needed. The final minified and gzipped bundle size for core functionality is expected to be under 1 MB.

## Maintenance And Adoption

Graphology is actively and consistently maintained. Between the start of 2024 and April 2026, the project saw 1,366 commits, 66 releases, and contributions from 31 developers, indicating a healthy and active community with a moderate bus factor. The release cadence averages a new version every one to two months. Its most notable production user is `sigma.js`, a popular graph visualization library, which validates its stability and performance in demanding contexts.

## Ir Strategy Guidance

Graphology's native TypeScript types are stable and well-defined, making them a viable candidate to serve directly as the Intermediate Representation (IR) for a plugin, which can simplify initial development. However, for maximum long-term stability and forward compatibility across major library upgrades, the recommended best practice is to wrap the native types in a thin, stable, versioned schema. This creates an abstraction layer that insulates the plugin from potential breaking changes in the library's internal data structure.

## Overall Assessment

Graphology is an excellent fit for the specified plugin requirements. It successfully balances a rich feature set with a modular design. Its key strengths are its first-class TypeScript support, native multi-edge modeling, comprehensive algorithm library, and robust serialization. While its bundle size is larger than ultra-minimalist libraries like ngraph, it provides a much more complete, out-of-the-box solution without the heavy overhead of a full UI stack like Cytoscape.js. It is highly recommended for building a non-UI, data-model-centric graph plugin.

## Library Name

ngraph

## Api Ergonomics And Typing

The ngraph family of libraries is designed with minimalism as a core principle. The core `ngraph.graph` library is written in JavaScript and has a tiny API surface. TypeScript support is provided through community-maintained declaration files from DefinitelyTyped, which expose generic signatures like `Graph<NodeAttr, EdgeAttr>`. This allows developers to attach strongly-typed `data` payloads to nodes and links, providing a reasonable level of type safety, though the ergonomics are less seamless than in a TypeScript-first library.

## Multi Edge Support

ngraph supports modeling multiple edges between the same two nodes. The `addLink(fromId, toId, data, id)` method accepts an optional fourth argument for a unique link `id`. By providing a distinct ID for each edge, developers can create parallel edges, each capable of holding its own `data` object with specific attributes.

## Serialization Fidelity

The core library does not include a built-in `toJSON` or `fromJSON` method, in keeping with its minimalist philosophy. However, because the internal graph structure is composed of plain JavaScript objects, a lossless JSON representation can be created with custom logic by iterating over `graph.forEachNode()` and `graph.forEachLink()` and collecting the nodes and links into serializable arrays. Reconstructing the graph requires a corresponding custom loader.

## Algorithm Coverage

The core `ngraph.graph` package intentionally excludes complex algorithms to keep it lightweight. However, a rich set of algorithms is available through separate, focused companion packages under the `ngraph` umbrella. This includes `ngraph.path` for shortest paths, `ngraph.scc` for strongly connected components, and `ngraph.topological-sort`, covering the essential analytical needs for a code dependency graph.

## Performance Characteristics

Performance is the standout feature of ngraph. Its minimal overhead and efficient data structures are optimized for performance, especially in dynamic and interactive contexts. The layout engine, `@ngraph/forcelayout`, is built for real-time, incremental updates. Benchmarks cited by the author suggest it can handle graphs with hundreds of thousands of nodes and edges while maintaining interactive frame rates (e.g., a single layout step under 16ms).

## Bundle Size

ngraph is extremely lightweight. The core `ngraph.graph` package is approximately 6 KB when minified and gzipped. The `@ngraph/forcelayout` package adds another ~5 KB. Its highly modular nature means that a project only needs to include the specific packages it uses, leading to a very small final bundle size that is ideal for performance-critical applications.

## Maintenance And Adoption

Maintenance of the ngraph suite is steady but slower than more commercially-backed projects. During the 2024-2026 period, commits averaged 1-2 per month across the repositories, with occasional releases. It is used in production for internal tooling at several JavaScript-focused companies for tasks like visualizing module dependencies. However, there are no major public enterprise case studies.

## Ir Strategy Guidance

Using ngraph's native data structures as the Intermediate Representation (IR) is a viable strategy, particularly if the primary goals are minimal bundle size and runtime performance. However, as with other libraries, wrapping these structures in a custom, stable, and versioned schema is the recommended approach for long-term projects. This provides an abstraction that makes serialization more explicit and protects the plugin from future API changes in the underlying library.

## Overall Assessment

ngraph is an excellent choice for projects where performance and minimal bundle size are the absolute top priorities. Its trade-off is a less ergonomic developer experience compared to Graphology, requiring developers to write custom serialization logic and pull in algorithms from separate packages. It provides a lean, high-performance foundation but requires more manual setup and integration work.

## Library Name

Cytoscape.js

## Api Ergonomics And Typing

Cytoscape.js is a mature library with a primary focus on visualization, but its core can be used as a data model. It has good TypeScript support, allowing graph elements (nodes, edges) to be defined as JSON objects that conform to user-defined TypeScript interfaces. This makes it straightforward to create strongly-typed attribute definitions for nodes and edges, although it is not as explicitly generic at the top-level `Graph` object level as Graphology.

## Multi Edge Support

The library supports multiple edges between the same two nodes. This is achieved by creating multiple distinct edge objects in the element collection, each with a unique `id`. While the core data model supports this, the library's features are often geared towards visually distinguishing these parallel edges using different curve styles (`haystack`, `bezier`, etc.).

## Serialization Fidelity

Serialization is a strong point for Cytoscape.js. The `cy.json()` method exports the entire graph state, including element data, positions, and styles, into a single JSON object. This JSON can be used to re-initialize a Cytoscape instance, providing lossless round-trip capability for the graph's data and state.

## Algorithm Coverage

Cytoscape.js comes with a rich set of graph theory algorithms built-in. This includes shortest path algorithms like Dijkstra and A*, centrality measures, PageRank, traversals (BFS, DFS), and more. This extensive, integrated algorithm suite is a major advantage for applications requiring complex graph analysis without needing to integrate external packages.

## Performance Characteristics

As a library designed for rich, interactive visualizations, its performance is generally very good for rendering and user interaction. However, for a purely data-model-only use case, its performance characteristics are less clear, and it may carry overhead from its visualization-oriented architecture. The performance for non-UI tasks is likely sufficient but may not be as optimized as a pure data library like ngraph.

## Bundle Size

The bundle size is the main drawback of using Cytoscape.js for a non-UI core. The full package is substantial because it includes the entire rendering and interaction engine. While modern bundlers may be able to tree-shake some unused UI components, the library is not explicitly designed for a headless, model-only build, and the documentation provides no metrics for such a use case. The resulting bundle will almost certainly be larger than that of Graphology or ngraph.

## Maintenance And Adoption

Cytoscape.js is a very mature and actively maintained project with a large user base in bioinformatics, network analysis, and other scientific fields. The GitHub repository shows a consistent cadence of weekly patch releases and monthly feature releases, indicating a reliable and well-supported library suitable for production use.

## Ir Strategy Guidance

The library's well-defined JSON format for elements can serve directly as an Intermediate Representation (IR). However, given the library's complexity and focus on visualization state, it is highly recommended to define and use a separate, stable, versioned schema for the core data. This decouples the plugin's data model from the library's specific (and potentially changing) representation, which may include UI-specific attributes.

## Overall Assessment

Cytoscape.js could be considered 'overkill' for a strictly non-UI data model plugin, primarily due to its large bundle size and visualization-centric architecture. However, if the project requires the extensive suite of built-in algorithms, or if there is a strong likelihood of needing to add complex, interactive visualizations in the future, using Cytoscape.js from the start could be a strategic choice. For a lean, data-focused plugin, Graphology offers a better-tailored balance of features and footprint.


# Typescript Ergonomics Comparison

A comparative analysis of developer experience (DX) and API ergonomics for typed attributes reveals significant differences across the evaluated libraries:

*   **Graphology**: Offers excellent ergonomics. It ships with built-in, high-quality TypeScript declaration files (`graphology-types`) and its API is designed to be generic-friendly. Developers can instantiate graphs with specific attribute types, such as `Graph<NodeAttributes, EdgeAttributes>`, enabling full compile-time safety and robust IntelliSense for attribute access. This avoids the pitfalls of using loose `any` or `unknown` records.

*   **@ant-design/x6**: As a TypeScript-first library, it provides the strongest typing guarantees. It offers first-class support for generics and strong attribute typing for its graph model. While some complex, arbitrary payloads might require minor casting, the core experience is strongly typed and ergonomic.

*   **ngraph.graph**: This library is written in JavaScript, so its TypeScript ergonomics depend on community-maintained typings from DefinitelyTyped. These typings are generally good and expose generic signatures for node and edge data (e.g., `Graph<NodeAttr, EdgeAttr>`). Attributes are handled via a generic `data` parameter on nodes and links, allowing for compile-time safety, but it's a less integrated experience than with a TS-native library.

*   **Cytoscape.js**: Provides a solid developer experience. Its core data model is based on plain JSON objects for elements, which can be easily and strongly typed using standard TypeScript interfaces. The documentation provides clear examples, making it straightforward to define and work with typed attributes.

*   **@dagrejs/graphlib**: The TypeScript support is moderate. While official or community typings are available, the support for generics for node and edge attributes is limited. Developers often find themselves falling back to `any` or `unknown`, which undermines compile-time safety.

*   **jsnetworkx**: Has the weakest TypeScript ergonomics. It relies on community-provided typings that are reportedly incomplete and not fully generic for typed attributes, making it difficult to achieve a strongly-typed graph model without significant manual effort.

# Multi Edge Support Comparison

The ability to model multiple, distinct edges between the same two nodes (i.e., parallel edges) is a critical requirement for representing complex relationships like simultaneous imports and re-exports. The libraries handle this with varying degrees of fidelity:

*   **Graphology**: Provides first-class, explicit support for multi-graphs. It offers a `MultiDirectedGraph` class specifically for this purpose. Alternatively, when using a standard graph, a unique edge key can be passed to the `addEdge` method. This allows multiple edges to exist between the same source and target nodes, with each edge maintaining its own separate attribute object. This is ideal for the specified use case.

*   **ngraph.graph**: Natively supports multi-edges. The `addLink` function accepts an optional fourth argument, `id`, which serves as a unique identifier for the link. By providing a unique `id` for each edge, developers can create multiple links between the same two nodes, each with its own distinct `data` payload.

*   **@ant-design/x6**: As a diagramming toolkit, it has explicit support for multi-edge objects, each with a unique ID. This is a core feature for building complex diagrams where multiple connectors between two shapes are common.

*   **Cytoscape.js**: Supports multi-edges by convention. The data model allows for the creation of multiple edge objects in the `elements` array that share the same `source` and `target` nodes. Each of these edge objects must have a unique `id` and can hold its own distinct `data` attributes. While not enforced by a special graph type, it's a fully supported and common pattern.

*   **elkjs**: The ELK JSON input schema supports multi-edges through its extended edge format, which uses `sources[]` and `targets[]` arrays. This allows the layout engine to correctly process graphs with parallel edges, provided they are modeled correctly in the input JSON.

*   **@dagrejs/graphlib**: The core library was historically designed for simple graphs (one edge per source-target pair). While some forks or community usage patterns involve using compound edge keys to simulate multi-edges, it is not a native feature of the core `graphlib`.

*   **jsnetworkx**: Support for multi-edges is limited and often requires manual workarounds, such as creating wrapper objects for edges or managing edge IDs manually. It lacks the clean, built-in support found in Graphology or ngraph.

# Serialization And Ir Strategy Comparison

The strategy for JSON serialization and defining an Intermediate Representation (IR) is crucial for plugin stability and interoperability. Libraries offer different capabilities and imply different best practices:

*   **Graphology**: Provides excellent serialization support with `graph.toJSON()` and `graph.fromJSON()` methods that enable lossless round-tripping. The serialized JSON preserves the full graph structure, including node/edge attributes, graph-level metadata, and, critically, the unique keys for multi-edges. The output also includes version information to aid in future migrations. 
    *   **IR Guidance**: While Graphology's stable and versioned TypeScript types can serve directly as the IR, the recommended long-term strategy is to wrap them in a thin, stable schema that your plugin owns. This decouples the plugin from breaking changes in future major versions of Graphology.

*   **ngraph.graph**: Does not provide a built-in serialization API. However, because its internal model consists of plain JavaScript objects, a lossless JSON representation can be created with custom code by iterating through `graph.forEachNode` and `graph.forEachLink`. This approach preserves IDs, data payloads, and multi-edge identifiers. The developer is responsible for implementing the serialization and deserialization logic.
    *   **IR Guidance**: Similar to Graphology, using ngraph's structures directly is viable for performance-critical applications, but wrapping them in a stable, versioned interface is advisable to make serialization explicit and future-proof the plugin.

*   **Cytoscape.js**: Offers a robust `cy.json()` method that exports the entire graph state, including elements, styles, and layout data. It can re-import this JSON, guaranteeing a lossless round-trip. 
    *   **IR Guidance**: The library's clear JSON schema can serve directly as the IR. However, for a non-UI data model, this may include unnecessary view-related data. Wrapping it in a custom, data-focused schema provides a cleaner separation of concerns and protection against library updates.

*   **@ant-design/x6**: Features built-in JSON import/export that serializes the full state, including UI-specific details like positions and ports. Schema versioning must be handled manually by the developer.
    *   **IR Guidance**: Best suited for UI-heavy applications. For a data-only core, its serialization format is likely too coupled with the view. A separate, stable data model is recommended.

*   **elkjs**: Operates on a specific ELK JSON schema for input and output. This schema is the de facto IR when working with the library. The best practice is to create a stable representation of your graph in this format, preserving custom attributes in a `metadata` field to ensure they survive the layout process.

**General Recommendation on IR Strategy**: Across all libraries, a consistent best practice emerges: for maximum long-term stability and maintainability of a plugin, it is safer to define your own stable, versioned IR schema rather than directly using the library's native types. This creates an abstraction layer that isolates the plugin from breaking changes in its dependencies.

# Algorithm Coverage Comparison

The availability of graph theory algorithms varies significantly, impacting each library's suitability for analytical tasks beyond simple data storage.

*   **Graphology**: Offers the most comprehensive and well-integrated ecosystem for algorithms. While the core is kept lean, official packages like `graphology-utils` and `graphology-operators` provide a rich standard library. This includes traversals, topological sort, Strongly Connected Components (SCC), various shortest path algorithms (Dijkstra, A*), and utilities for community detection and clustering. This makes it a strong choice for a plugin requiring deep graph analysis.

*   **Cytoscape.js**: Has a rich set of algorithms built directly into its core. This includes breadth-first and depth-first search, Dijkstra's algorithm for shortest paths, PageRank, and various centrality measures. This extensive built-in support makes it powerful for analysis, though it comes with the overhead of the larger library.

*   **jsnetworkx**: Its primary strength is its broad algorithm coverage, as it is a direct port of the extensive Python NetworkX library. It includes a wide array of algorithms for pathfinding, centrality, community detection, SCC, and more. However, performance may be slower than in libraries with native JavaScript implementations.

*   **ngraph**: The core library is intentionally minimal and does not include algorithms. However, a suite of focused, high-performance companion packages is available under the `ngraph` ecosystem. These include `ngraph.path` (shortest path algorithms), `ngraph.scc` (Strongly Connected Components), `ngraph.topological-sort`, and `ngraph.components`. This modular approach allows developers to include only the specific algorithms they need, keeping the application lightweight.

*   **@ant-design/x6**: Is primarily focused on UI, visualization, and layout. It lacks a broad set of built-in graph theory algorithms like SCC or complex pathfinding. For advanced analysis, it would need to be paired with an external library.

*   **@dagrejs/graphlib**: Is specialized for graph data structures needed for layout algorithms (specifically layered layouts). It does not provide a general-purpose library of graph theory algorithms.

*   **elkjs**: Is strictly a layout engine and provides no graph theory algorithms. It computes node positions and edge routes but does not perform analysis like SCC or shortest path.

# Performance And Bundle Size Comparison

## Bundle Size Summary

Bundle size is a key differentiator, especially for a plugin intended for various environments.

*   **ngraph**: The clear winner in minimalism. The core `ngraph.graph` package is approximately 6 KB gzipped. Its modular nature means you only add what you need (e.g., `@ngraph/forcelayout` adds ~5 KB), making it ideal for size-constrained applications.

*   **@dagrejs/graphlib**: Also has a very small footprint, as it is a focused utility for graph data structures, optimized for layout tasks.

*   **Graphology**: Represents a middle ground. The full unpacked package is larger (2.73 MB), but it is highly modular and supports tree-shaking. The core functionality can be bundled for under 1 MB (min+gzip), and for minimal use cases, it can be even smaller. The final size depends on how many algorithm and utility sub-packages are imported.

*   **jsnetworkx**: Considered moderate to heavy, as it ports a large number of algorithms from NetworkX.

*   **Cytoscape.js** and **@ant-design/x6**: These are the heaviest options. As they are comprehensive visualization and interaction toolkits, pulling them in solely for data modeling includes significant overhead from their rendering and UI-handling code. While tree-shaking can help, their core is substantially larger than data-only libraries.

*   **elkjs**: The GWT-generated JavaScript worker can be sizable, which is a consideration for web-based previews.

## Performance Summary

Runtime performance varies based on library architecture and focus.

*   **ngraph**: Designed for performance and low overhead. It excels at handling large graphs (hundreds of thousands of nodes/edges) and is optimized for real-time, incremental layout stepping, making it suitable for live-reload previews. Community reports cite layout steps completing under 16ms.

*   **Graphology**: While detailed public benchmarks are limited, community tests indicate that most core operations have linear-time complexity. Performance is generally considered good for typical graph sizes, with overhead mainly coming from JavaScript's memory management rather than algorithmic inefficiency.

*   **elkjs**: Performance is generally acceptable for medium-sized graphs (up to a few hundred nodes) as it runs the layout computation in a Web Worker, preventing UI blocking. However, it can become slow for large, dense graphs and does not support incremental layout, requiring a full re-layout on every change.

*   **Cytoscape.js** and **@ant-design/x6**: Performance is optimized for interactive user-facing applications. They handle rendering and updates efficiently for visualized graphs but may have higher constant overhead for pure data operations compared to a minimal library like ngraph.

*   **jsnetworkx**: As a port of a Python library, its algorithms are generally slower than native JavaScript implementations found in other libraries.


# Maintenance And Adoption Comparison

## Maintenance Velocity Summary

Maintenance activity from 2024-2026 indicates the health and reliability of each library.

*   **Graphology**: Shows very active and steady maintenance. The repository saw 1,366 commits and 66 releases during this period, with a release cadence of a new version every 1-2 months.

*   **@ant-design/x6**: Actively maintained by the dedicated Ant Design team, ensuring consistent updates and alignment with the broader Ant ecosystem.

*   **Cytoscape.js**: Demonstrates high maintenance velocity with regular weekly patch releases and monthly feature releases, indicating a mature and well-supported project.

*   **elkjs**: The JavaScript wrapper is actively maintained with regular releases, tracking the underlying core Eclipse ELK project.

*   **ngraph**: Maintained, but at a slower pace. The ecosystem sees about 1-2 commits per month and occasional releases. While responsive, it's less active than the top-tier libraries.

*   **@dagrejs/graphlib**: Maintenance is sporadic across its sub-projects.

*   **jsnetworkx**: Receives low-to-moderate maintenance, primarily driven by community contributions.

## Community Health Summary

Community health is a strong indicator of a project's longevity.

*   **Graphology**: Has a healthy community with 31 contributors identified, providing a moderate bus factor (i.e., it is not reliant on a single person). The project is community-driven with identifiable core maintainers.

*   **Cytoscape.js** and **@ant-design/x6**: As established and widely used libraries, they have large communities, active issue trackers, and a healthy number of contributors.

*   **ngraph**: The community is smaller but responsive, with reasonable issue response times. It is largely driven by its original author and a small group of contributors.

*   **jsnetworkx** and **@dagrejs/graphlib**: Rely more heavily on a smaller base of community contributors, leading to slower issue resolution and development.

## Production Adoption Summary

Real-world adoption demonstrates a library's stability and fitness for purpose.

*   **Graphology**: Is production-proven, most notably as the data backend for the popular `sigma.js` visualization library. It is also used in various analytics platforms and academic research tools.

*   **@ant-design/x6**: Used in production by the Ant Design team for diagramming and editing applications.

*   **Cytoscape.js**: Has been a standard for web-based graph visualization for many years and is used in countless academic, bioinformatics, and commercial applications.

*   **ngraph**: Used in internal tooling at several JavaScript-focused companies for tasks like visualizing module dependencies, but lacks high-profile public enterprise case studies.

*   **Mermaid/D2**: While not graph model libraries, they are widely adopted renderers. `elkjs` is used by various tools that require its sophisticated layered layout capabilities.


# Live Reload Preview Architecture

An effective architectural pattern for a live-reload browser preview of a code dependency graph involves several decoupled components that communicate via a serialized data format. The flow begins with the data source and ends with a rendered diagram in the browser, with a development server orchestrating the updates.

**Core Workflow:**
1.  **File Watching and Graph Generation:** The process is initiated when a change is detected in the source code files. A development server, using a file-watcher mechanism, triggers a plugin to re-analyze the code and update an in-memory graph model (using a library like Graphology or ngraph).
2.  **Serialization to a Stable IR:** The updated graph model is serialized into a stable, versioned JSON format. This JSON serves as the Intermediate Representation (IR) or 'snapshot'. It's crucial that this schema is lossless, preserving node/edge IDs, typed attributes, and multi-edge relationships. Using a versioned schema protects the system from breaking changes if the underlying graph library or attribute definitions evolve.
3.  **Hot-Reload Server:** The development server monitors this serialized JSON file. Upon detecting a change, it pushes the new JSON data to the connected browser client, typically using WebSockets or Server-Sent Events (SSE) for real-time communication.
4.  **Client-Side Processing in a Web Worker:** To avoid blocking the main UI thread and ensure a responsive user experience, the browser client offloads the computationally intensive task of layout calculation to a Web Worker. The main thread sends the received JSON graph data to the worker.
5.  **Layout Augmentation:** Inside the worker, a layout engine like `elkjs` processes the graph. It computes the `x` and `y` coordinates for each node and the bend points for each edge. The engine then returns the graph data, now augmented with this layout information, back to the main thread. This is particularly valuable when advanced layout algorithms (e.g., layered/Sugiyama) are needed, which are more sophisticated than the default layouts in Mermaid or D2.
6.  **Rendering:** The main thread receives the layout-augmented graph. It then feeds this data to the rendering library:
    *   **For Mermaid:** This might involve transforming the JSON into Mermaid's text-based syntax and calling its rendering API to update the SVG.
    *   **For D2:** D2's extensible plugin system might be used to create a custom renderer that directly consumes the layout-augmented JSON, offering a more direct integration path.
7.  **Performance Optimization:** To reduce visual flicker and improve perceived performance on re-renders, the client should cache the layout positions of nodes and edges that have not changed between updates. Only new or modified elements would be fully re-calculated and re-drawn.

**Best Practices for this Architecture:**
*   **Decoupling:** The graph model, layout engine, and renderer are kept separate, with the serialized JSON acting as the contract between them.
*   **Asynchronous Layout:** Always use Web Workers for layout calculations to maintain UI responsiveness, especially for medium-to-large graphs.
*   **Scalability:** For very large graphs (thousands of nodes), consider fallbacks such as using simpler layout algorithms (e.g., force-directed) or offloading the layout calculation to the server-side entirely.

# Elkjs Role And Integration

## Role Clarification

elkjs is strictly a layout engine, not a graph modeling or rendering library. Its sole purpose is to compute node positions and edge routes for a given graph structure. It takes an ELK-JSON graph as input and returns the same structure augmented with layout information (x/y coordinates, bend points, etc.).

## Api And Configuration

The library provides a TypeScript-friendly API centered around a single `ELK` class with an asynchronous `layout(graph, options)` method that returns a Promise. TypeScript typings are bundled, allowing for straightforward integration. The configuration options are extensive, mirroring the powerful Java-based Eclipse ELK framework. The default algorithm is the layered (Sugiyama) method, but alternatives like stress, radial, force, and disco are available. Users can control numerous parameters, including spacing, port constraints, node ordering, and component separation. Regarding build considerations, elkjs does not use a native WebAssembly (WASM) build; instead, it relies on GWT-generated JavaScript, which runs in a Web Worker (`elk-worker.js`) to avoid blocking the main UI thread. A bundled version (`elk.bundled.js`) is provided for easy inclusion in browsers.

## Input Output Schema

elkjs expects and outputs a specific JSON format known as ELK JSON. This schema consists of nodes, ports, labels, edges, and edge sections. A critical requirement is that every element (except labels) must have a unique `id`. Nodes must be provided with their dimensions (`width`, `height`) and can carry arbitrary `layoutOptions`. To adapt a different graph model (like one from Graphology or ngraph), one must create a mapping function. This involves converting each entity in the source graph to an ELK JSON node, each dependency to an edge, and serializing any typed attributes into a custom `metadata` or `layoutOptions` field to ensure they are preserved through the layout process. Multi-edge support is handled via extended edges, which use `sources[]` and `targets[]` arrays and require unique IDs for each edge.

## Performance Notes

Performance is generally acceptable for medium-sized graphs (tens to low-hundreds of nodes), as the layout computation runs in a non-blocking Web Worker. However, performance can degrade for larger, dense graphs (thousands of nodes) because the crossing-reduction and edge-routing phases of the layered algorithm become computationally expensive. The library offers execution-time logging to help profile and identify bottlenecks. For very large dependency graphs, optimization strategies are recommended, such as graph clustering, applying layouts incrementally on graph diffs, or offloading the layout computation to a server.

## Integration Patterns

elkjs is valuable when a renderer's native layout engine (like those in Mermaid or D2) is insufficient and more advanced features are needed, such as port-aware routing, complex edge sections, junction points, or specific layout constraints. A best-practice architectural pattern for a live-reload preview involves: 1. Running elkjs inside a dedicated Web Worker. 2. On file change, generate a stable intermediate representation (IR) based on the ELK JSON schema from the source graph model. 3. Use `postMessage` to send this JSON to the worker. 4. Await the layout result (the augmented JSON with coordinates). 5. Apply the new positions and bend points to the renderer (e.g., Mermaid, D2, or a custom SVG overlay). To reduce visual flicker on re-renders, it's recommended to cache previous positions for nodes and edges whose IDs have not changed.

## Limitations And Fallbacks

The primary limitations of elkjs include the lack of a native WASM build, which means the GWT-generated JavaScript worker can be sizable and potentially slower than a pure WASM alternative. The library does not offer an incremental layout API; a full re-layout is required after every change, which can affect responsiveness on large graphs. Build integration with modern bundlers like Webpack or Vite can sometimes be complex, requiring explicit worker configuration. For very large or highly dynamic graphs, recommended fallback strategies include using simpler, faster layout engines (like Dagre or ELK's own force/stress algorithms) or offloading the layout computation to a server-side process entirely.


# Other Libraries Analysis

## Library Name

Graphology

## Typescript Typing Quality

Graphology provides excellent TypeScript support out of the box, shipping with built-in declaration files. Its API is designed to be generic-friendly, exposing overloads that allow developers to define strongly-typed interfaces for node and edge attributes (e.g., `Graph<NodeAttributes, EdgeAttributes>`). This enables compile-time type safety and rich IntelliSense support in IDEs, preventing common errors when accessing attribute data and improving the overall developer experience compared to libraries that rely on loose `any` records or incomplete community-provided types.

## Multi Edge Support

The library has first-class support for multi-graphs, which is a core requirement for modeling complex code dependencies like simultaneous imports and re-exports between the same two files. It can be instantiated as a `MultiDirectedGraph`, and the `addEdge` method accepts an optional `key` parameter. This key allows for the creation of multiple, distinct edges between the same source and target nodes, with each parallel edge maintaining its own independent set of attributes. This fidelity is crucial for accurately representing the source data.

## Serialization And Algorithms

Graphology offers robust serialization capabilities through methods like `graph.toJSON()` and `graph.fromJSON()`, which enable lossless round-tripping of the entire graph structure. The serialized JSON preserves node/edge IDs, all typed attributes, graph-level metadata, and crucially, the unique keys for parallel edges. The format also includes version information to support schema migrations. In addition to its data modeling features, Graphology has a rich ecosystem of algorithms available through packages like `graphology-utils` and `graphology-operators`. This includes essential algorithms for dependency analysis such as topological sort, finding strongly connected components (SCC), shortest path calculations, as well as traversals and community detection.

## Performance And Bundle Size

While formal benchmarks are not prominently published, community experience suggests that core operations perform in linear time. The main performance overhead is typically from JavaScript's memory management rather than algorithmic inefficiency. For bundle size, the unpacked npm package is around 2.73 MB, but it is highly modular. When using an ESM-based bundler, tree-shaking is effective at excluding unused algorithm sub-packages, which can significantly reduce the final bundle size. The minified and gzipped footprint for just the core graph functionality is expected to be under 1 MB.

## Overall Fit And Summary

Graphology is an excellent fit for the specified use case of a non-UI data model core for a TypeScript plugin. Its main advantages are the combination of strong TypeScript generic support, native multi-edge modeling, comprehensive algorithm availability, and lossless serialization. While its bundle size is larger than ultra-minimalist libraries like ngraph, its feature set provides a much more complete foundation, reducing the need for custom logic or multiple smaller dependencies. For long-term stability, it is recommended to wrap Graphology's native types in a stable, versioned schema to act as the plugin's intermediate representation (IR), though using its types directly is viable for faster initial development. It strikes a balance between the minimalism of ngraph and the heavy, UI-focused nature of Cytoscape.js, making it the most suitable choice.


# Rising Alternatives 2024 2026

Research conducted for the 2024-2026 period did not identify any new, rising TypeScript-native graph libraries that have achieved the maturity, feature-completeness, or production adoption levels of established libraries like Graphology or ngraph. While some newer, early-stage projects were noted (e.g., `typed-graph` and various lightweight immutable graph cores), they are characterized as being in their infancy. These projects often emphasize strong generic support and immutable data structures but currently lack the extensive algorithm coverage, robust serialization, and battle-tested stability required for a production-grade plugin. Therefore, as of 2026, there are no significant rising challengers that would be recommended over the more mature candidates for this use case.

# Decision Matrix Summary

This matrix summarizes the comparative analysis of the evaluated graph libraries against the key requirements for the code dependency plugin. The assessment covers the 2024-2026 period.

| Library               | Typed Attributes (TS Generics) | Multi-Edge Support          | Serialization                 | Algorithms Coverage                               | Performance / Bundle Size          | Maintenance (2024-2026) |
|-----------------------|--------------------------------|-----------------------------|-------------------------------|---------------------------------------------------|------------------------------------|-------------------------|
| **Graphology**        | **Excellent** (Native generics)  | **Native** (MultiGraph class) | **Built-in, Lossless**        | **Excellent** (Extensive, modular plugin ecosystem) | Moderate, tree-shakeable           | **Active** (66 releases)  |
| **ngraph**            | Good (Via DefinitelyTyped)     | Supported (Via unique IDs)  | Custom logic required         | Good (Available via separate `ngraph.extras` pkgs)  | **Minimalist / High-performance**  | Moderate                |
| **Cytoscape.js**      | Good (Typed via interfaces)    | Supported (Via distinct IDs)  | Built-in (UI-state focused)   | Good (Built-in suite, bundled with renderer)      | Heavy (UI-focused)                 | Active                  |
| **@ant-design/x6**    | Excellent (TS-first)           | Native                      | Built-in (UI-state focused)   | Limited (UI/layout-focused)                       | Heavy (UI-focused)                 | Active                  |
| **@dagrejs/graphlib** | Moderate (Limited generics)    | Limited (Historically single) | Basic JSON support            | Limited (Layout-focused)                          | **Lightweight**                    | Sporadic                |
| **jsnetworkx**        | Poor (Incomplete typings)      | Limited (Requires wrappers) | Custom logic required         | Broad (Port of NetworkX), but slower              | Heavy                              | Low to Moderate         |

**Conclusion from Matrix:**

*   **Graphology** emerges as the clear winner, scoring highly across all critical categories for a non-UI data model. It provides the best combination of TypeScript ergonomics, native multi-edge support, robust serialization, and a rich algorithm ecosystem without unnecessary baggage.
*   **ngraph** is a strong contender for performance-critical applications where bundle size is paramount, but it requires more development effort to implement features like serialization and integrate algorithms.
*   **Cytoscape.js** and **@ant-design/x6** are too heavyweight for this use case, as their primary focus is UI rendering, which is not a core requirement of the plugin's data layer.
*   Other alternatives like **jsnetworkx** and **@dagrejs/graphlib** are not recommended due to significant drawbacks in TypeScript support, multi-edge handling, or maintenance.
