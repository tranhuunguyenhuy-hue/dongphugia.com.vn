import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WRITE_FREEZE_ERROR_CODE, WriteFreezeError } from '@/lib/write-freeze'

const mocks = vi.hoisted(() => ({
    requirePermission: vi.fn(),
    getCurrentUser: vi.fn(),
    revalidatePath: vi.fn(),
    quoteUpdate: vi.fn(),
    itemUpdate: vi.fn(),
    customerFind: vi.fn(),
    customerCreate: vi.fn(),
    customerUpdate: vi.fn(),
    auditCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        quote_requests: { update: mocks.quoteUpdate },
        quote_items: { update: mocks.itemUpdate },
        customers: {
            findUnique: mocks.customerFind,
            create: mocks.customerCreate,
            update: mocks.customerUpdate,
        },
        audit_logs: { create: mocks.auditCreate },
    },
}))

vi.mock('@/lib/auth/get-current-user', () => ({
    requirePermission: mocks.requirePermission,
    getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

import { completeQuote, updateQuoteData } from './actions'

const quoteData = {
    vat_rate: 0,
    shipping_fee: 0,
    admin_notes: '',
    items: [{ id: 2, admin_unit_price: 100, admin_quantity: 1 }],
    phone: '0900000000',
    name: 'STG-DEMO Quote',
    email: '',
    quote_number: 'STG-DEMO-QUOTE',
}

describe('quote builder write-freeze behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requirePermission.mockResolvedValue({ id: 1, role: 'admin' })
    })

    it('returns the structured contract and performs no follow-on work', async () => {
        mocks.quoteUpdate.mockRejectedValueOnce(new WriteFreezeError('quote-update'))

        const result = await updateQuoteData(1, quoteData)

        expect(result).toMatchObject({ code: WRITE_FREEZE_ERROR_CODE, statusCode: 503 })
        expect(mocks.itemUpdate).not.toHaveBeenCalled()
        expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('stops completeQuote when its save step is frozen', async () => {
        mocks.quoteUpdate.mockRejectedValueOnce(new WriteFreezeError('quote-update'))

        const result = await completeQuote(1, quoteData)

        expect(result).toMatchObject({ code: WRITE_FREEZE_ERROR_CODE, statusCode: 503 })
        expect(mocks.customerFind).not.toHaveBeenCalled()
        expect(mocks.customerCreate).not.toHaveBeenCalled()
        expect(mocks.customerUpdate).not.toHaveBeenCalled()
        expect(mocks.quoteUpdate).toHaveBeenCalledOnce()
        expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
})
