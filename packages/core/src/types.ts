export type SchemaVersion = '1'
export type Language = 'ts' | 'py' | 'go' | 'swift'
export type SymbolKind =
  | 'file' | 'module' | 'class' | 'method' | 'function'
  | 'variable' | 'interface' | 'type' | 'enum' | 'namespace'
  | 'property' | 'constructor' | 'field' | 'enum_member'
export type Origin = 'extractor' | 'inferred'
export type Confidence = 'verified' | 'inferred'
export type RelationshipKind = 'imports' | 'calls' | 'extends' | 'implements' | 'references'

export interface Viz {
  label?: string
  shape?: 'box' | 'ellipse' | 'diamond' | 'database' | 'component'
  style?: 'filled' | 'dashed' | 'rounded' | 'solid'
  color?: string
  fillcolor?: string
  penwidth?: number
  arrowhead?: 'none' | 'normal' | 'vee' | 'diamond'
}

export interface CFDocument {
  relPath: string
  absPath: string
  language: Language
}

export interface CFSymbol {
  id: string
  kind: SymbolKind
  name: string
  detail?: string
  absPath: string
  relPath: string
  language: Language
  origin: Origin
  confidence: Confidence
  parent?: string
  viz?: Viz
  workspaceRel?: string   // (Task 18) — set by reRootIR for monorepo workspace identification
}

export interface Relationship {
  id: string
  from: string
  to: string
  kind: RelationshipKind
  source?: { file: string; line: number; col?: number }
  language: Language
  confidence: Confidence
  evidence?: string
  viz?: Viz
}

export interface IRMeta {
  extractor: { name: string; version: string; invocation: string }
  root: string
  partial?: boolean
  errors?: unknown[]
  diff?: { added: Relationship[]; removed: Relationship[]; upgraded: Relationship[] }
  workspaces?: Record<string, { displayName: string; manifest: 'pnpm' | 'pkgjson' | 'pyproject' | 'setup.py' | 'fs-fallback' }>   // (Task 18)
}

export interface IR {
  schemaVersion: SchemaVersion
  meta: IRMeta
  documents: CFDocument[]
  symbols: CFSymbol[]
  relationships: Relationship[]
}
