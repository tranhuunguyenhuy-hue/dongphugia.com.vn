import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        alias: {
            'vinext/server/fetch-handler': path.resolve(__dirname, './tests/helpers/vinext-handler-stub.ts'),
            'cloudflare:workers': path.resolve(__dirname, './tests/helpers/cloudflare-workers-stub.ts'),
            '@': path.resolve(__dirname, './src'),
            '@dpg/app-contracts': path.resolve(
                __dirname,
                './packages/app-contracts/src/index.ts',
            ),
        },
        // exclude next.js specific files
        exclude: [
            '**/node_modules/**',
            '**/.next/**',
            '**/dist/**',
            '**/.worker-package/**',
            '.artifacts/**',
            'tests/readiness/**',
        ],
    },
})
