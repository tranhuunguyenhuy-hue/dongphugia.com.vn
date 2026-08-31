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
