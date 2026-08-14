import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('lockGlobalPublishingGate', () => {
    it('uses an advisory lock that preserves the runtime role SELECT-only boundary', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'src/lib/publishing/authority.ts'),
            'utf8',
        )

        expect(source).toContain('pg_advisory_xact_lock')
        expect(source).toContain('publishing.global-gate')
        expect(source).toContain('lockPublishingGlobalGateAuthority')
        expect(source).not.toContain('FOR SHARE')
        expect(source).not.toContain('FOR KEY SHARE')
        expect(source).not.toContain('FOR UPDATE')
    })
})
