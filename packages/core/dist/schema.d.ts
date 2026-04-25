import { z } from 'zod';
export declare const SymbolSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        function: "function";
        type: "type";
        property: "property";
        file: "file";
        enum: "enum";
        module: "module";
        class: "class";
        method: "method";
        variable: "variable";
        interface: "interface";
        namespace: "namespace";
        constructor: "constructor";
        field: "field";
        enum_member: "enum_member";
    }>;
    name: z.ZodString;
    detail: z.ZodOptional<z.ZodString>;
    absPath: z.ZodString;
    relPath: z.ZodString;
    language: z.ZodEnum<{
        ts: "ts";
        py: "py";
        go: "go";
        swift: "swift";
    }>;
    origin: z.ZodEnum<{
        extractor: "extractor";
        inferred: "inferred";
    }>;
    confidence: z.ZodEnum<{
        inferred: "inferred";
        verified: "verified";
    }>;
    parent: z.ZodOptional<z.ZodString>;
    viz: z.ZodOptional<z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        shape: z.ZodOptional<z.ZodEnum<{
            box: "box";
            ellipse: "ellipse";
            diamond: "diamond";
            database: "database";
            component: "component";
        }>>;
        style: z.ZodOptional<z.ZodEnum<{
            filled: "filled";
            dashed: "dashed";
            rounded: "rounded";
            solid: "solid";
        }>>;
        color: z.ZodOptional<z.ZodString>;
        fillcolor: z.ZodOptional<z.ZodString>;
        penwidth: z.ZodOptional<z.ZodNumber>;
        arrowhead: z.ZodOptional<z.ZodEnum<{
            diamond: "diamond";
            none: "none";
            normal: "normal";
            vee: "vee";
        }>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const RelationshipSchema: z.ZodObject<{
    id: z.ZodString;
    from: z.ZodString;
    to: z.ZodString;
    kind: z.ZodEnum<{
        imports: "imports";
        calls: "calls";
        extends: "extends";
        implements: "implements";
        references: "references";
    }>;
    source: z.ZodOptional<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        col: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    language: z.ZodEnum<{
        ts: "ts";
        py: "py";
        go: "go";
        swift: "swift";
    }>;
    confidence: z.ZodEnum<{
        inferred: "inferred";
        verified: "verified";
    }>;
    evidence: z.ZodOptional<z.ZodString>;
    viz: z.ZodOptional<z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        shape: z.ZodOptional<z.ZodEnum<{
            box: "box";
            ellipse: "ellipse";
            diamond: "diamond";
            database: "database";
            component: "component";
        }>>;
        style: z.ZodOptional<z.ZodEnum<{
            filled: "filled";
            dashed: "dashed";
            rounded: "rounded";
            solid: "solid";
        }>>;
        color: z.ZodOptional<z.ZodString>;
        fillcolor: z.ZodOptional<z.ZodString>;
        penwidth: z.ZodOptional<z.ZodNumber>;
        arrowhead: z.ZodOptional<z.ZodEnum<{
            diamond: "diamond";
            none: "none";
            normal: "normal";
            vee: "vee";
        }>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const IRSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1">;
    meta: z.ZodObject<{
        extractor: z.ZodObject<{
            name: z.ZodString;
            version: z.ZodString;
            invocation: z.ZodString;
        }, z.core.$strict>;
        root: z.ZodString;
        partial: z.ZodOptional<z.ZodBoolean>;
        errors: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        diff: z.ZodOptional<z.ZodObject<{
            added: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                from: z.ZodString;
                to: z.ZodString;
                kind: z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    extends: "extends";
                    implements: "implements";
                    references: "references";
                }>;
                source: z.ZodOptional<z.ZodObject<{
                    file: z.ZodString;
                    line: z.ZodNumber;
                    col: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                language: z.ZodEnum<{
                    ts: "ts";
                    py: "py";
                    go: "go";
                    swift: "swift";
                }>;
                confidence: z.ZodEnum<{
                    inferred: "inferred";
                    verified: "verified";
                }>;
                evidence: z.ZodOptional<z.ZodString>;
                viz: z.ZodOptional<z.ZodObject<{
                    label: z.ZodOptional<z.ZodString>;
                    shape: z.ZodOptional<z.ZodEnum<{
                        box: "box";
                        ellipse: "ellipse";
                        diamond: "diamond";
                        database: "database";
                        component: "component";
                    }>>;
                    style: z.ZodOptional<z.ZodEnum<{
                        filled: "filled";
                        dashed: "dashed";
                        rounded: "rounded";
                        solid: "solid";
                    }>>;
                    color: z.ZodOptional<z.ZodString>;
                    fillcolor: z.ZodOptional<z.ZodString>;
                    penwidth: z.ZodOptional<z.ZodNumber>;
                    arrowhead: z.ZodOptional<z.ZodEnum<{
                        diamond: "diamond";
                        none: "none";
                        normal: "normal";
                        vee: "vee";
                    }>>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            removed: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                from: z.ZodString;
                to: z.ZodString;
                kind: z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    extends: "extends";
                    implements: "implements";
                    references: "references";
                }>;
                source: z.ZodOptional<z.ZodObject<{
                    file: z.ZodString;
                    line: z.ZodNumber;
                    col: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                language: z.ZodEnum<{
                    ts: "ts";
                    py: "py";
                    go: "go";
                    swift: "swift";
                }>;
                confidence: z.ZodEnum<{
                    inferred: "inferred";
                    verified: "verified";
                }>;
                evidence: z.ZodOptional<z.ZodString>;
                viz: z.ZodOptional<z.ZodObject<{
                    label: z.ZodOptional<z.ZodString>;
                    shape: z.ZodOptional<z.ZodEnum<{
                        box: "box";
                        ellipse: "ellipse";
                        diamond: "diamond";
                        database: "database";
                        component: "component";
                    }>>;
                    style: z.ZodOptional<z.ZodEnum<{
                        filled: "filled";
                        dashed: "dashed";
                        rounded: "rounded";
                        solid: "solid";
                    }>>;
                    color: z.ZodOptional<z.ZodString>;
                    fillcolor: z.ZodOptional<z.ZodString>;
                    penwidth: z.ZodOptional<z.ZodNumber>;
                    arrowhead: z.ZodOptional<z.ZodEnum<{
                        diamond: "diamond";
                        none: "none";
                        normal: "normal";
                        vee: "vee";
                    }>>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            upgraded: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                from: z.ZodString;
                to: z.ZodString;
                kind: z.ZodEnum<{
                    imports: "imports";
                    calls: "calls";
                    extends: "extends";
                    implements: "implements";
                    references: "references";
                }>;
                source: z.ZodOptional<z.ZodObject<{
                    file: z.ZodString;
                    line: z.ZodNumber;
                    col: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                language: z.ZodEnum<{
                    ts: "ts";
                    py: "py";
                    go: "go";
                    swift: "swift";
                }>;
                confidence: z.ZodEnum<{
                    inferred: "inferred";
                    verified: "verified";
                }>;
                evidence: z.ZodOptional<z.ZodString>;
                viz: z.ZodOptional<z.ZodObject<{
                    label: z.ZodOptional<z.ZodString>;
                    shape: z.ZodOptional<z.ZodEnum<{
                        box: "box";
                        ellipse: "ellipse";
                        diamond: "diamond";
                        database: "database";
                        component: "component";
                    }>>;
                    style: z.ZodOptional<z.ZodEnum<{
                        filled: "filled";
                        dashed: "dashed";
                        rounded: "rounded";
                        solid: "solid";
                    }>>;
                    color: z.ZodOptional<z.ZodString>;
                    fillcolor: z.ZodOptional<z.ZodString>;
                    penwidth: z.ZodOptional<z.ZodNumber>;
                    arrowhead: z.ZodOptional<z.ZodEnum<{
                        diamond: "diamond";
                        none: "none";
                        normal: "normal";
                        vee: "vee";
                    }>>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    documents: z.ZodArray<z.ZodObject<{
        relPath: z.ZodString;
        absPath: z.ZodString;
        language: z.ZodEnum<{
            ts: "ts";
            py: "py";
            go: "go";
            swift: "swift";
        }>;
    }, z.core.$strict>>;
    symbols: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            function: "function";
            type: "type";
            property: "property";
            file: "file";
            enum: "enum";
            module: "module";
            class: "class";
            method: "method";
            variable: "variable";
            interface: "interface";
            namespace: "namespace";
            constructor: "constructor";
            field: "field";
            enum_member: "enum_member";
        }>;
        name: z.ZodString;
        detail: z.ZodOptional<z.ZodString>;
        absPath: z.ZodString;
        relPath: z.ZodString;
        language: z.ZodEnum<{
            ts: "ts";
            py: "py";
            go: "go";
            swift: "swift";
        }>;
        origin: z.ZodEnum<{
            extractor: "extractor";
            inferred: "inferred";
        }>;
        confidence: z.ZodEnum<{
            inferred: "inferred";
            verified: "verified";
        }>;
        parent: z.ZodOptional<z.ZodString>;
        viz: z.ZodOptional<z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            shape: z.ZodOptional<z.ZodEnum<{
                box: "box";
                ellipse: "ellipse";
                diamond: "diamond";
                database: "database";
                component: "component";
            }>>;
            style: z.ZodOptional<z.ZodEnum<{
                filled: "filled";
                dashed: "dashed";
                rounded: "rounded";
                solid: "solid";
            }>>;
            color: z.ZodOptional<z.ZodString>;
            fillcolor: z.ZodOptional<z.ZodString>;
            penwidth: z.ZodOptional<z.ZodNumber>;
            arrowhead: z.ZodOptional<z.ZodEnum<{
                diamond: "diamond";
                none: "none";
                normal: "normal";
                vee: "vee";
            }>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    relationships: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        from: z.ZodString;
        to: z.ZodString;
        kind: z.ZodEnum<{
            imports: "imports";
            calls: "calls";
            extends: "extends";
            implements: "implements";
            references: "references";
        }>;
        source: z.ZodOptional<z.ZodObject<{
            file: z.ZodString;
            line: z.ZodNumber;
            col: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>;
        language: z.ZodEnum<{
            ts: "ts";
            py: "py";
            go: "go";
            swift: "swift";
        }>;
        confidence: z.ZodEnum<{
            inferred: "inferred";
            verified: "verified";
        }>;
        evidence: z.ZodOptional<z.ZodString>;
        viz: z.ZodOptional<z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            shape: z.ZodOptional<z.ZodEnum<{
                box: "box";
                ellipse: "ellipse";
                diamond: "diamond";
                database: "database";
                component: "component";
            }>>;
            style: z.ZodOptional<z.ZodEnum<{
                filled: "filled";
                dashed: "dashed";
                rounded: "rounded";
                solid: "solid";
            }>>;
            color: z.ZodOptional<z.ZodString>;
            fillcolor: z.ZodOptional<z.ZodString>;
            penwidth: z.ZodOptional<z.ZodNumber>;
            arrowhead: z.ZodOptional<z.ZodEnum<{
                diamond: "diamond";
                none: "none";
                normal: "normal";
                vee: "vee";
            }>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
//# sourceMappingURL=schema.d.ts.map