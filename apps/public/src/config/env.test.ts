import { describe, expect, it } from 'vitest'

import { getPublicAppEnvironment } from './env'

describe('Public application environment contract', () => {
  it('accepts a local build without browser configuration', () => {
    expect(getPublicAppEnvironment({})).toMatchObject({
      application: 'public',
      environment: 'local',
      origin: 'http://localhost:3000',
      previewNoindex: false,
    })
  })

  it('requires noindex and a non-Production origin for Preview', () => {
    expect(() =>
      getPublicAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://public-preview.invalid',
      }),
    ).toThrow('PUBLIC_PREVIEW_NOINDEX_REQUIRED')

    expect(() =>
      getPublicAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://www.dongphugia.vn',
        PREVIEW_NOINDEX: 'true',
      }),
    ).toThrow('PUBLIC_PREVIEW_PRODUCTION_DOMAIN_FORBIDDEN')
  })

  it('accepts the exact Production authority only for Production', () => {
    expect(
      getPublicAppEnvironment({
        APP_ENV: 'production',
        APP_ORIGIN: 'https://www.dongphugia.vn',
      }).origin,
    ).toBe('https://www.dongphugia.vn')

    expect(() =>
      getPublicAppEnvironment({
        APP_ENV: 'production',
        APP_ORIGIN: 'https://public-preview.invalid',
      }),
    ).toThrow('PUBLIC_PRODUCTION_ORIGIN_MISMATCH')
  })

  it('fails closed on privileged or unknown browser environment variables', () => {
    expect(() =>
      getPublicAppEnvironment({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      }),
    ).toThrow('PUBLIC_PRIVILEGED_BROWSER_ENV_FORBIDDEN')

    expect(() =>
      getPublicAppEnvironment({
        NEXT_PUBLIC_ADMIN_SESSION: 'test-only',
      }),
    ).toThrow('PUBLIC_BROWSER_ENV_NOT_ALLOWLISTED')

    expect(() =>
      getPublicAppEnvironment({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-only',
      }),
    ).toThrow('PUBLIC_BROWSER_ENV_NOT_ALLOWLISTED')
  })
})
