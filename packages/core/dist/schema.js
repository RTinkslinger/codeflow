import { z } from 'zod';
const VizSchema = z.object({
    label: z.string().optional(),
    shape: z.enum(['box', 'ellipse', 'diamond', 'database', 'component']).optional(),
    style: z.enum(['filled', 'dashed', 'rounded', 'solid']).optional(),
    color: z.string().optional(),
    fillcolor: z.string().optional(),
    penwidth: z.number().optional(),
    arrowhead: z.enum(['none', 'normal', 'vee', 'diamond']).optional(),
}).strict();
export const SymbolSchema = z.object({
    id: z.string().min(1),
    kind: z.enum([
        'file', 'module', 'class', 'method', 'function', 'variable',
        'interface', 'type', 'enum', 'namespace', 'property',
        'constructor', 'field', 'enum_member',
    ]),
    name: z.string().min(1),
    detail: z.string().optional(),
    absPath: z.string().min(1),
    relPath: z.string().min(1),
    language: z.enum(['ts', 'py', 'go', 'swift']),
    origin: z.enum(['extractor', 'inferred']),
    confidence: z.enum(['verified', 'inferred']),
    parent: z.string().optional(),
    viz: VizSchema.optional(),
    workspaceRel: z.string().optional(),
}).strict();
export const RelationshipSchema = z.object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    kind: z.enum(['imports', 'calls', 'extends', 'implements', 'references']),
    source: z.object({
        file: z.string(),
        line: z.number().int(),
        col: z.number().int().optional(),
    }).strict().optional(),
    language: z.enum(['ts', 'py', 'go', 'swift']),
    confidence: z.enum(['verified', 'inferred']),
    evidence: z.string().optional(),
    viz: VizSchema.optional(),
}).strict();
const DocumentSchema = z.object({
    relPath: z.string().min(1),
    absPath: z.string().min(1),
    language: z.enum(['ts', 'py', 'go', 'swift']),
}).strict();
export const IRSchema = z.object({
    schemaVersion: z.literal('1'),
    meta: z.object({
        extractor: z.object({ name: z.string(), version: z.string(), invocation: z.string() }).strict(),
        root: z.string(),
        partial: z.boolean().optional(),
        errors: z.array(z.unknown()).optional(),
        diff: z.object({
            added: z.array(RelationshipSchema),
            removed: z.array(RelationshipSchema),
            upgraded: z.array(RelationshipSchema),
        }).strict().optional(),
        workspaces: z.record(z.string(), z.object({
            displayName: z.string(),
            manifest: z.enum(['pnpm', 'pkgjson', 'pyproject', 'setup.py', 'fs-fallback']),
        }).strict()).optional(),
    }).strict(),
    documents: z.array(DocumentSchema),
    symbols: z.array(SymbolSchema),
    relationships: z.array(RelationshipSchema),
}).strict();
//# sourceMappingURL=schema.js.map