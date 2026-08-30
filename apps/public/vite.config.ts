import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import vinext from 'vinext'

const sourceCommit = process.env.BUILD_SOURCE_SHA?.trim()

if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error('PUBLIC_WORKER_SOURCE_SHA_REQUIRED')
}

export default defineConfig({
  define: {
    __DPG_BUILD_SOURCE_SHA__: JSON.stringify(sourceCommit),
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
