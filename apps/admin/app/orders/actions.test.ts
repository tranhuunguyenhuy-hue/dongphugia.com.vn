import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireActiveStaff, createAdminServerClient, rpc, revalidatePath } = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(), createAdminServerClient: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(),
}))

vi.mock('../../src/auth/require-staff', () => ({ requireActiveStaff }))
vi.mock('../../src/supabase/server', () => ({ createAdminServerClient }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { confirmGuestOrderCommercialTerms, updateGuestOrderStatus } from './actions'

const input = {
  orderId: 11,
  shippingFee: 15000,
  installationFees: [{ orderItemId: 21, feePerUnit: 0 }],
  idempotencyKey: '01234567-89ab-4cde-8f01-234567890abc',
}

describe('Admin guest order actions', () => {
  beforeEach(() => {
    requireActiveStaff.mockReset().mockResolvedValue({ capabilities: ['orders:update_status'] })
    createAdminServerClient.mockReset().mockResolvedValue({ schema: () => ({ rpc }) })
    rpc.mockReset().mockResolvedValue({ error: null })
    revalidatePath.mockReset()
  })

  it('denies confirmation without the staff capability and rejects malformed fees', async () => {
    requireActiveStaff.mockResolvedValueOnce({ capabilities: ['orders:read'] })
    await expect(confirmGuestOrderCommercialTerms(input)).resolves.toMatchObject({ ok: false })
    await expect(confirmGuestOrderCommercialTerms({ ...input, shippingFee: -1 })).resolves.toMatchObject({ ok: false })
    await expect(confirmGuestOrderCommercialTerms({ ...input, installationFees: [input.installationFees[0], input.installationFees[0]] })).resolves.toMatchObject({ ok: false })
    await expect(confirmGuestOrderCommercialTerms({ ...input, installationFees: [null] } as never)).resolves.toMatchObject({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls the idempotent confirmation RPC without changing receipt snapshots', async () => {
    await expect(confirmGuestOrderCommercialTerms(input)).resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('phase2_admin_order_confirm', expect.objectContaining({
      p_order_id: 11,
      p_shipping_fee: 15000,
      p_installation_fees: [{ order_item_id: 21, fee_per_unit: 0 }],
      p_idempotency_key: input.idempotencyKey,
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/orders/11')
  })

  it('allows only non-confirmation lifecycle steps through the status RPC', async () => {
    await expect(updateGuestOrderStatus({
      orderId: 11, status: 'inventory_check', idempotencyKey: input.idempotencyKey,
    })).resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('phase2_admin_order_update_status', expect.objectContaining({ p_status: 'inventory_check' }))
    rpc.mockClear()
    await expect(updateGuestOrderStatus({
      orderId: 11, status: 'confirmed', idempotencyKey: input.idempotencyKey,
    })).resolves.toMatchObject({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })
})
