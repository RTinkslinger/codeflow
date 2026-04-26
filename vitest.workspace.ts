import { defineWorkspace } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const workspaceAliases = {
  '@codeflow/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
  '@codeflow/canonical': path.resolve(__dirname, 'packages/canonical/src/index.ts'),
  '@codeflow/test-utils': path.resolve(__dirname, 'packages/test-utils/src/index.ts'),
  '@codeflow/extractor-depcruise': path.resolve(__dirname, 'packages/extractor-depcruise/src/index.ts'),
  '@codeflow/extractor-treesitter-python': path.resolve(__dirname, 'packages/extractor-treesitter-python/src/index.ts'),
  '@codeflow/extractor-scip-typescript': path.resolve(__dirname, 'packages/extractor-scip-typescript/src/index.ts'),
  '@codeflow/extractor-scip-python': path.resolve(__dirname, 'packages/extractor-scip-python/src/index.ts'),
  '@codeflow/renderer-mermaid': path.resolve(__dirname, 'packages/renderer-mermaid/src/index.ts'),
  '@codeflow/preview': path.resolve(__dirname, 'packages/preview/src/index.ts'),
}

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  {
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
    },
    resolve: { alias: workspaceAliases },
  },
])
