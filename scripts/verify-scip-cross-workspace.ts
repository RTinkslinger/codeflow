#!/usr/bin/env tsx
// Phase 0 verification: empirically confirm SCIP symbol-string stability
// across separate scip-typescript invocations on a 2-package fixture.
// Output captured in PR1 description as the gate.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const FIXTURE = path.resolve(__dirname, 'fixtures/scip-cross-2pkg')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scip-verify-'))

function indexAndPrint(workspacePath: string, label: string): Record<string, unknown> {
  const out = path.join(tmp, `${label}.scip`)
  console.log(`[${label}] indexing ${workspacePath}`)
  execFileSync('scip-typescript', ['index', '--output', out, workspacePath], { stdio: 'inherit' })
  const json = execFileSync('scip', ['print', '--json', out], { encoding: 'utf-8' })
  const start = json.indexOf('{')
  return JSON.parse(json.slice(start)) as Record<string, unknown>
}

function extractSymbols(scip: Record<string, unknown>): { symbol: string; roles: number; file: string }[] {
  const out: { symbol: string; roles: number; file: string }[] = []
  const docs = (scip['documents'] as Array<Record<string, unknown>>) ?? []
  for (const doc of docs) {
    const file = doc['relative_path'] as string
    const occ = (doc['occurrences'] as Array<Record<string, unknown>>) ?? []
    for (const o of occ) {
      out.push({ symbol: (o['symbol'] as string) ?? '', roles: (o['symbol_roles'] as number) ?? 0, file })
    }
  }
  return out
}

console.log('=== Phase 0 Verification ===\n')

// Mode A: invoke scip-typescript on each package separately
const a_alone = indexAndPrint(`${FIXTURE}/pkg-a`, 'a-alone')
const b_alone = indexAndPrint(`${FIXTURE}/pkg-b`, 'b-alone')

const aSymbols = extractSymbols(a_alone)
const bSymbols = extractSymbols(b_alone)

// Q1: Role bitmask values for actual import statements
console.log('\n--- Q1: Role bitmask check ---')
const importOccurrences = bSymbols.filter(s => s.symbol.includes('pkg-a') && s.roles !== 0)
console.log(`pkg-b occurrences referencing pkg-a (with roles set):`, importOccurrences.slice(0, 5))
console.log(`Distinct role values seen in pkg-b:`, [...new Set(bSymbols.map(s => s.roles))].sort())
console.log(`Expected: 1=Definition, 2=Import (per SCIP protobuf)`)

// Q2: Symbol-string stability — does pkg-a's exported symbol match pkg-b's referenced symbol?
console.log('\n--- Q2: Symbol-string stability (separate invocations) ---')
const aDefSymbols = aSymbols.filter(s => (s.roles & 1) !== 0).map(s => s.symbol)
const bRefSymbols = bSymbols.filter(s => s.symbol.includes('pkg-a')).map(s => s.symbol)
const intersect = aDefSymbols.filter(s => bRefSymbols.includes(s))
console.log(`pkg-a Definitions: ${aDefSymbols.length}, pkg-b refs to pkg-a: ${bRefSymbols.length}`)
console.log(`Intersection (stable across invocations): ${intersect.length}`)
console.log(`Sample stable symbols:`, intersect.slice(0, 3))
if (intersect.length === 0) {
  console.error('❌ GATE FAIL: zero stable symbols across separate invocations. Design must pivot.')
  process.exit(1)
}

// Coverage cases
console.log('\n--- Q2 coverage cases ---')
console.log(`Default exports (look for "default" in symbol):`, intersect.filter(s => s.toLowerCase().includes('default')).slice(0, 3))
console.log(`Re-exports (look for sub.ts source):`, aDefSymbols.filter(s => s.includes('sub')).slice(0, 3))
console.log(`Type imports (Greeter):`, intersect.filter(s => s.includes('Greeter')).slice(0, 3))

console.log('\n✅ Phase 0 verification passed. Symbol IDs are stable across separate invocations.')
console.log(`Captured ${intersect.length} stable cross-workspace symbols.`)
