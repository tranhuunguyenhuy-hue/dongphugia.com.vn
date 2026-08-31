import { describe, expect, it } from 'vitest'

import { PUBLIC_APPLICATION_NAME, PUBLIC_ROUTE_OWNERSHIP } from './routes'

describe('Public route ownership baseline', () => {
  it('owns only the foundation routes in the Public deployable', () => {
    expect(PUBLIC_APPLICATION_NAME).toBe('public')
    expect(PUBLIC_ROUTE_OWNERSHIP.map(({ path }) => path)).toEqual([
      '/',
      '/robots.txt',
      '/api/health',
    ])
    expect(PUBLIC_ROUTE_OWNERSHIP.every(({ owner }) => owner === 'public')).toBe(true)
  })
})
