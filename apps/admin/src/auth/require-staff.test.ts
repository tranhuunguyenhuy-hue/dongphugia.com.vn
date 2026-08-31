import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createAdminServerClient, getClaims, redirect, rpc } = vi.hoisted(() => ({
  createAdminServerClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../supabase/server', () => ({ createAdminServerClient }))
vi.mock('next/navigation', () => ({ redirect }))

import { requireActiveStaff } from './require-staff'

describe('Admin active Staff mapping boundary', () => {
  beforeEach(() => {
    getClaims.mockReset()
    rpc.mockReset()
    redirect.mockReset().mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    })
    createAdminServerClient.mockReset().mockResolvedValue({
      auth: { getClaims },
      schema: () => ({ rpc }),
    })
  })

  it('requires a verified session claim before querying the V1 staff context', async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: null })

    await expect(requireActiveStaff()).rejects.toThrow('REDIRECT:/login')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns only an active V1 staff context', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'active-user' } }, error: null })
    const context = {
      auth_user_id: 'active-user',
      email: 'staff@example.invalid',
      display_name: 'Active Staff',
      status: 'active',
      roles: ['Product'],
      capabilities: ['catalogue.read'],
    }
    rpc.mockResolvedValue({ data: context, error: null })

    await expect(requireActiveStaff()).resolves.toEqual(context)
    expect(rpc).toHaveBeenCalledWith('staff_context')
  })

  it('fails closed when the identity is unmapped, invited, disabled, or malformed', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'unmapped-user' } }, error: null })
    rpc.mockResolvedValue({
      data: { auth_user_id: 'unmapped-user', status: 'invited', roles: [], capabilities: [] },
      error: null,
    })

    await expect(requireActiveStaff()).rejects.toThrow('REDIRECT:/login?error=staff_access')
  })
})
