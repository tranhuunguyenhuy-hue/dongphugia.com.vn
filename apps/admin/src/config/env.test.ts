import { describe, expect, it } from 'vitest'

import {
  getAdminAppEnvironment,
  getAdminSupabasePublicConfig,
} from './env'

describe('Admin application environment contract', () => {
  it('keeps the private noindex posture in every environment', () => {
    expect(getAdminAppEnvironment({})).toMatchObject({
      application: 'admin',
      environment: 'local',
      origin: 'http://localhost:3001',
      noindex: true,
    })

    expect(() =>
      getAdminAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://admin-preview.invalid',
      }),
    ).toThrow('ADMIN_PREVIEW_NOINDEX_REQUIRED')

    expect(
      getAdminAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://admin-preview.invalid',
        PREVIEW_NOINDEX: 'true',
      }),
    ).toMatchObject({
      application: 'admin',
      environment: 'preview',
      origin: 'https://admin-preview.invalid',
      noindex: true,
    })
  })

  it('rejects the Production authority in Preview', () => {
    expect(() =>
      getAdminAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://admin.dongphugia.vn',
        PREVIEW_NOINDEX: 'true',
      }),
    ).toThrow('ADMIN_PREVIEW_PRODUCTION_DOMAIN_FORBIDDEN')
  })

  it('allows only the publishable Supabase browser identity', () => {
    expect(
      getAdminAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://admin-preview.invalid',
        PREVIEW_NOINDEX: 'true',
        NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-only',
      }).application,
    ).toBe('admin')

    expect(() =>
      getAdminAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://admin-preview.invalid',
        PREVIEW_NOINDEX: 'true',
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      }),
    ).toThrow('ADMIN_PRIVILEGED_BROWSER_ENV_FORBIDDEN')

    expect(() =>
      getAdminAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://admin-preview.invalid',
        PREVIEW_NOINDEX: 'true',
        NEXT_PUBLIC_STAFF_TOKEN: 'test-only',
      }),
    ).toThrow('ADMIN_BROWSER_ENV_NOT_ALLOWLISTED')
  })

  it('keeps server-only Auth Admin authority out of the browser allowlist', () => {
    expect(
      getAdminAppEnvironment({
        APP_ENV: 'preview',
        APP_ORIGIN: 'https://admin-preview.invalid',
        PREVIEW_NOINDEX: 'true',
        SUPABASE_SECRET_KEY: 'sb_secret_server-only-test',
      }).application,
    ).toBe('admin')

    expect(getAdminSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    })).toEqual({
      url: 'https://supabase.invalid',
      publishableKey: 'sb_publishable_test',
    })
  })
})
