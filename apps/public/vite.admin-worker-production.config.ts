import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import vinext from 'vinext'
import path from 'node:path'

const appRoot = path.dirname(new URL(import.meta.url).pathname)

export default defineConfig({
  root: path.resolve(appRoot, '../..'),
  resolve: {
    alias: [
      {
        find: /^react-server-dom-webpack(?=\/|$)/,
        replacement: path.join(appRoot, 'node_modules/react-server-dom-webpack'),
      },
      {
        find: /^next\/script$/,
        replacement: path.join(appRoot, 'node_modules/vinext/dist/shims/script.js'),
      },
    ],
  },
  define: { 'process.env.NEXT_PUBLIC_GTM_ID': 'undefined' },
  ssr: { noExternal: ['@next/third-parties'] },
  plugins: [
    vinext(),
    cloudflare({
      configPath: path.join(appRoot, 'wrangler.admin-worker-build.jsonc'),
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
})
