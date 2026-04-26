#!/usr/bin/env tsx
// Release build: compile all packages, then commit dist/ + node_modules to release branch
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function run(cmd: string, opts?: { cwd?: string }) {
  console.log(`$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

// 1. Clean build
run('pnpm install --frozen-lockfile')
run('pnpm -r run build')

// 2. Verify critical artifacts exist
// pnpm puts each package's deps in its own node_modules/, not the root
const checks = [
  'packages/cli/dist/main.js',
  'packages/cli/node_modules/graphology',
  'packages/core/node_modules/zod',
  'packages/core/node_modules/pino',
  'packages/preview/node_modules/ws',
  'packages/preview/node_modules/chokidar',
]
for (const check of checks) {
  if (!fs.existsSync(path.resolve(check))) {
    console.error(`MISSING: ${check}`)
    process.exit(1)
  }
}
console.log('✓ All critical artifacts present')

// 3. Switch to release branch and commit
run('git checkout -B release')

// Stage source files (version bump, plugin metadata, commands, config)
run('git add package.json .claude-plugin/ commands/ .mcp.json')

// Force-add built artifacts (normally gitignored on main)
run('git add -f packages/cli/dist/ packages/core/dist/ packages/canonical/dist/')
run('git add -f packages/extractor-depcruise/dist/ packages/extractor-treesitter-python/dist/')
run('git add -f packages/extractor-scip-typescript/dist/ packages/extractor-scip-python/dist/')
run('git add -f packages/renderer-mermaid/dist/ packages/preview/dist/')
// pnpm workspace: runtime deps live in each package's own node_modules/
run('git add -f packages/cli/node_modules/ packages/core/node_modules/')
run('git add -f packages/canonical/node_modules/ packages/preview/node_modules/')
run('git add -f packages/extractor-depcruise/node_modules/ packages/extractor-treesitter-python/node_modules/')
run('git add -f packages/extractor-scip-typescript/node_modules/ packages/extractor-scip-python/node_modules/')
run('git add -f packages/renderer-mermaid/node_modules/ packages/test-utils/node_modules/')
run('git add -f node_modules/')

const version = (JSON.parse(fs.readFileSync('package.json', 'utf-8')) as { version?: string }).version
if (!version) throw new Error('package.json missing version field')

// Enforce that all three version files are in sync before releasing
const pluginJson = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf-8')) as { version?: string }
const marketplaceJson = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf-8')) as {
  metadata?: { version?: string }; plugins?: Array<{ version?: string }>
}
const pluginVersion = pluginJson.version
const metaVersion = marketplaceJson.metadata?.version
const pluginsVersion = marketplaceJson.plugins?.[0]?.version
const allVersions = [version, pluginVersion, metaVersion, pluginsVersion]
if (allVersions.some(v => v !== version)) {
  console.error(`Version mismatch — all three files must match before release:`)
  console.error(`  package.json:                           ${version}`)
  console.error(`  .claude-plugin/plugin.json:             ${pluginVersion}`)
  console.error(`  .claude-plugin/marketplace.json meta:   ${metaVersion}`)
  console.error(`  .claude-plugin/marketplace.json plugin: ${pluginsVersion}`)
  process.exit(1)
}
run(`git commit -m "release: v${version}"`)
run(`git tag -f v${version}`)

console.log(`\n✓ Release branch ready. Push with:\n  git push --force origin release && git push --force origin v${version}`)
