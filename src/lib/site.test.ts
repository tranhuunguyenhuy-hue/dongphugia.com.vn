import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    DEFAULT_CANONICAL_SITE_URL,
    canonicalUrl,
    getCanonicalSiteUrl,
    getSiteRuntimeConfig,
} from './site'

afterEach(() => vi.unstubAllEnvs())

describe('canonical site URL', () => {
    it('uses a safe local fallback unless a target is selected', () => {
        expect(DEFAULT_CANONICAL_SITE_URL).toBe('https://www.dongphugia.vn')
        expect(getCanonicalSiteUrl()).toBe('http://localhost:3000')
        expect(getSiteRuntimeConfig()).toMatchObject({
            target: 'local',
            allowIndexing: false,
        })
    })

    it('requires the exact canonical URL for production and keeps indexing off until the runtime explicitly enables it', () => {
        vi.stubEnv('DEPLOY_TARGET', 'production')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', DEFAULT_CANONICAL_SITE_URL)
        vi.stubEnv('PRODUCTION_INDEXING_ENABLED', '')
        expect(getSiteRuntimeConfig()).toEqual({
            target: 'production',
            siteUrl: DEFAULT_CANONICAL_SITE_URL,
            allowIndexing: false,
        })

        vi.stubEnv('PRODUCTION_INDEXING_ENABLED', 'true')
        expect(getSiteRuntimeConfig().allowIndexing).toBe(true)
        expect(canonicalUrl('/blog')).toBe(`${DEFAULT_CANONICAL_SITE_URL}/blog`)
    })

    it.each([
        'http://www.dongphugia.vn',
        'https://dongphugia.com.vn',
        'https://dongphugia-staging.example.test',
    ])('rejects a non-canonical production URL: %s', (siteUrl) => {
        vi.stubEnv('DEPLOY_TARGET', 'production')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl)
        expect(getSiteRuntimeConfig).toThrow('Production requires')
    })

    it('requires staging to use a non-production HTTPS hostname and disables indexing', () => {
        vi.stubEnv('DEPLOY_TARGET', 'staging')
        vi.stubEnv(
            'NEXT_PUBLIC_SITE_URL',
            'https://dongphugia-staging.example.test',
        )
        expect(getSiteRuntimeConfig()).toEqual({
            target: 'staging',
            siteUrl: 'https://dongphugia-staging.example.test',
            allowIndexing: false,
        })
    })

    it.each([
        'http://dongphugia-staging.example.test',
        'https://www.dongphugia.vn',
        'https://dongphugia.com.vn',
    ])('rejects an unsafe staging URL: %s', (siteUrl) => {
        vi.stubEnv('DEPLOY_TARGET', 'staging')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl)
        expect(getSiteRuntimeConfig).toThrow('Staging requires')
    })

    it('rejects unsupported targets and non-HTTP local URLs', () => {
        vi.stubEnv('DEPLOY_TARGET', 'preview')
        expect(getSiteRuntimeConfig).toThrow('DEPLOY_TARGET must be')
        vi.stubEnv('DEPLOY_TARGET', 'local')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'ftp://localhost:3000')
        expect(getSiteRuntimeConfig).toThrow('Local requires')
    })
})
