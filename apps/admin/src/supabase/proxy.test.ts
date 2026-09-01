import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createServerClient, getClaims } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({ createServerClient }))

import { NextRequest } from 'next/server'

import { updateAdminSession } from './proxy'

function request(path: string) {
  return new NextRequest(`https://admin-preview.invalid${path}`)
}

describe('Admin Supabase SSR proxy session boundary', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.invalid')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    getClaims.mockReset()
    createServerClient.mockReset()
    createServerClient.mockImplementation(() => ({ auth: { getClaims } }))
  })

  it('redirects an unauthenticated protected request and preserves a safe next path', async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: null })

    const response = await updateAdminSession(request('/staff?tab=users'))

    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
    expect(new URL(response.headers.get('location')!).searchParams.get('next'))
      .toBe('/staff?tab=users')
    expect(getClaims).toHaveBeenCalledOnce()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('allows public Auth paths without a session while keeping private headers', async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: null })

    const response = await updateAdminSession(request('/login'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('passes an existing session and persists SSR cookie refreshes', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'active-user' } }, error: null })
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([
        { name: 'sb-refresh', value: 'rotated', options: { httpOnly: true, path: '/' } },
      ])
      return { auth: { getClaims } }
    })

    const response = await updateAdminSession(request('/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('sb-refresh=rotated')
    expect(getClaims).toHaveBeenCalledOnce()
  })
})
