import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { rpc, createAdminServerClient } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminServerClient: vi.fn(),
}))

vi.mock('../supabase/server', () => ({ createAdminServerClient }))

import { getAdminAuditEvents } from './queries'

describe('Admin audit query', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: { admin: [], publishing: [] }, error: null })
    createAdminServerClient.mockReset().mockResolvedValue({ schema: () => ({ rpc }) })
  })

  it('uses the authenticated audit RPC with a bounded page', async () => {
    await expect(getAdminAuditEvents(50, 0)).resolves.toEqual([])
    expect(rpc).toHaveBeenCalledWith('leo542_admin_audit_list', { p_limit: 50, p_offset: 0 })
  })

  it('returns no audit payload when authorization or RPC access fails', async () => {
    rpc.mockResolvedValue({ data: { admin: [{ id: 1 }] }, error: { message: 'FORBIDDEN' } })
    await expect(getAdminAuditEvents()).resolves.toBeNull()
  })
})
