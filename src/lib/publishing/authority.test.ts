import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('lockGlobalPublishingGate', () => {
    it('uses a share lock that preserves the runtime role SELECT-only boundary', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'src/lib/publishing/authority.ts'),
            'utf8',
        )

        expect(source).toContain('FOR SHARE')
        expect(source).not.toContain('FOR KEY SHARE')
        expect(source).not.toContain('FOR UPDATE')
    })
})
