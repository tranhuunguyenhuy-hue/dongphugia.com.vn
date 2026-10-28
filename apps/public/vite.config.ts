import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import vinext from 'vinext'

const sourceCommit = process.env.BUILD_SOURCE_SHA?.trim()
const catalogueCheckpoint = process.env.PUBLIC_CATALOGUE_CHECKPOINT?.trim() || null
if (catalogueCheckpoint && !/^[0-9a-f]{40}$/.test(catalogueCheckpoint)) throw new Error('PUBLIC_CATALOGUE_CHECKPOINT_INVALID')

if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error('PUBLIC_WORKER_SOURCE_SHA_REQUIRED')
}

export default defineConfig({
  publicDir: '../../public',
  define: {
    __DPG_BUILD_SOURCE_SHA__: JSON.stringify(sourceCommit),
    __DPG_PUBLIC_CATALOGUE_CHECKPOINT__: JSON.stringify(catalogueCheckpoint),
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
