import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CANONICAL_SITE_URL, canonicalUrl, getCanonicalSiteUrl } from './site'

afterEach(() => vi.unstubAllEnvs())

describe('canonical site URL', () => {
    it('uses the approved www .vn production domain', () => {
        expect(DEFAULT_CANONICAL_SITE_URL).toBe('https://www.dongphugia.vn')
        expect(getCanonicalSiteUrl()).toBe('https://www.dongphugia.vn')
    })

    it('normalizes the apex production host to www', () => {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://dongphugia.vn/')
        expect(canonicalUrl('/blog')).toBe('https://www.dongphugia.vn/blog')
    })

    it('preserves a staging hostname supplied by the deployment', () => {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://dongphugia-staging.example.test')
        expect(getCanonicalSiteUrl()).toBe('https://dongphugia-staging.example.test')
    })
})
