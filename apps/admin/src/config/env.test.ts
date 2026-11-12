import { describe, expect, it } from 'vitest'

import {
  getAdminBasePath,
  getAdminPath,
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

  it('requires a noindex posture in Staging and keeps the app under /admin', () => {
    expect(() => getAdminAppEnvironment({
      APP_ENV: 'staging',
      APP_ORIGIN: 'https://dpg-staging.tranhuunguyenhuy.workers.dev',
    })).toThrow('ADMIN_STAGING_NOINDEX_REQUIRED')

    expect(getAdminAppEnvironment({
      APP_ENV: 'staging',
      APP_ORIGIN: 'https://dpg-staging.tranhuunguyenhuy.workers.dev',
      PREVIEW_NOINDEX: 'true',
    })).toMatchObject({ environment: 'staging', noindex: true })
    expect(getAdminBasePath({ ADMIN_BASE_PATH: '/admin' })).toBe('/admin')
    expect(getAdminPath('/login', { ADMIN_BASE_PATH: '/admin' })).toBe('/admin/login')
    expect(getAdminPath('/admin/login', { ADMIN_BASE_PATH: '/admin' })).toBe('/admin/login')
    expect(() => getAdminBasePath({ ADMIN_BASE_PATH: '/staff' })).toThrow('ADMIN_BASE_PATH_INVALID')
    expect(() => getAdminPath('/\\attacker.example', { ADMIN_BASE_PATH: '/admin' })).toThrow('ADMIN_PATH_INVALID')
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
