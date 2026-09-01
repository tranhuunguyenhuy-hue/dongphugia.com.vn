import { describe, expect, it } from 'vitest'

import { ADMIN_APPLICATION_NAME, ADMIN_ROUTE_OWNERSHIP } from './routes'

describe('Admin route ownership baseline', () => {
  it('owns the foundation and minimal Auth shell routes only', () => {
    expect(ADMIN_APPLICATION_NAME).toBe('admin')
    expect(ADMIN_ROUTE_OWNERSHIP.map(({ path }) => path)).toEqual([
      '/',
      '/login',
      '/forgot-password',
      '/reset-password',
      '/auth/callback',
      '/auth/confirm',
      '/auth/logout',
      '/robots.txt',
      '/api/health',
    ])
    expect(ADMIN_ROUTE_OWNERSHIP.every(({ owner }) => owner === 'admin')).toBe(true)
  })
})
