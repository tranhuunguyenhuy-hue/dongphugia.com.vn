import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig, type Plugin } from 'vite'
import vinext from 'vinext'

const sourceCommit = process.env.BUILD_SOURCE_SHA?.trim()
const catalogueCheckpoint = process.env.PUBLIC_CATALOGUE_CHECKPOINT?.trim() || null
if (catalogueCheckpoint && !/^[0-9a-f]{40}$/.test(catalogueCheckpoint)) throw new Error('PUBLIC_CATALOGUE_CHECKPOINT_INVALID')

if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error('PUBLIC_WORKER_SOURCE_SHA_REQUIRED')
}

// React is CommonJS. Load its exports directly in vinext navigation so Rolldown
// does not generate a variable ESM interop wrapper for this React object. The
// two interop modes otherwise cascade into different SSR chunk hashes.
function stableNavigationReactImport(): Plugin {
  return {
    name: 'dpg:stable-navigation-react-import',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').includes('/vinext/dist/shims/navigation.js')) return
      const source = 'import * as React$1 from "react";'
      if (!code.includes(source)) throw new Error('VINEXT_NAVIGATION_REACT_IMPORT_CHANGED')
      return code.replace(source, 'const React$1 = require("react");')
    },
  }
}

export default defineConfig({
  publicDir: '../../public',
  define: {
    __DPG_BUILD_SOURCE_SHA__: JSON.stringify(sourceCommit),
    __DPG_PUBLIC_CATALOGUE_CHECKPOINT__: JSON.stringify(catalogueCheckpoint),
  },
  plugins: [
    stableNavigationReactImport(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
