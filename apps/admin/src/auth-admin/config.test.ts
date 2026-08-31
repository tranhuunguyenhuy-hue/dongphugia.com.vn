import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { getAdminSupabaseSecretKey } from './config'

describe('server-only Auth Admin configuration', () => {
	it('requires the backend-only secret without exposing a value', () => {
    expect(getAdminSupabaseSecretKey({ SUPABASE_SECRET_KEY: 'sb_secret_test' }))
      .toBe('sb_secret_test')
    expect(() => getAdminSupabaseSecretKey({})).toThrow('ADMIN_SUPABASE_SECRET_KEY_REQUIRED')
  })
})
