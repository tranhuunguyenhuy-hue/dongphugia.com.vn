import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    findProducts: vi.fn(),
    createOrder: vi.fn(),
    isAllowed: vi.fn(),
    loggerInfo: vi.fn(),
    loggerError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: { $transaction: mocks.transaction },
}))

vi.mock('@/lib/rate-limiter', () => ({
    getClientIp: () => '127.0.0.1',
    rateLimiter: { isAllowed: mocks.isAllowed },
    RATE_LIMITS: { ordersPost: { maxReqs: 5, windowMs: 60_000 } },
}))

vi.mock('@/lib/utils', () => ({
    generateOrderNumber: () => 'DPG-TEST-000001',
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: mocks.loggerInfo,
        error: mocks.loggerError,
    },
}))

import { POST } from './route'

const availableProduct = {
    id: 101,
    name: 'Tên từ database',
    sku: 'DB-SKU-101',
    price: 1_000_000,
    sale_price: 900_000,
    online_discount_amount: 50_000,
    is_active: true,
    publication_status: 'public',
    pdp_visibility: 'public',
    sellable_status: 'sellable',
}

function createRequest(items: unknown[]) {
    return new NextRequest('https://example.test/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            customer_name: 'Nguyễn Văn A',
            customer_phone: '0901234567',
            customer_email: '',
            items,
        }),
    })
}

describe('POST /api/orders', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAllowed.mockReturnValue(true)
        mocks.findProducts.mockResolvedValue([availableProduct])
        mocks.createOrder.mockImplementation(async ({ data }) => ({
            id: 42,
            order_number: data.order_number,
            total: data.total,
        }))
        mocks.transaction.mockImplementation(async callback => callback({
            products: { findMany: mocks.findProducts },
            orders: { create: mocks.createOrder },
        }))
    })

    it('ignores client price, SKU and name and stores authoritative snapshots', async () => {
        const response = await POST(createRequest([{
            productId: 101,
            quantity: 2,
            installOption: 'install',
            price: 1,
            finalPrice: 1,
            sku: 'TAMPERED-SKU',
            name: 'Tampered name',
        }]))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(mocks.findProducts).toHaveBeenCalledTimes(1)
        expect(mocks.createOrder).toHaveBeenCalledWith({
            data: expect.objectContaining({
                subtotal: 2_100_000,
                total: 2_100_000,
                order_items: {
                    create: [{
                        product_id: 101,
                        product_name: 'Tên từ database (Cần Lắp Đặt | Giảm Online 50000đ)',
                        product_sku: 'DB-SKU-101',
                        quantity: 2,
                        unit_price: 1_050_000,
                        total_price: 2_100_000,
                    }],
                },
            }),
        })
        expect(body).toMatchObject({ success: true, total: 2_100_000 })
    })

    it('rejects invalid quantities before opening a transaction', async () => {
        const response = await POST(createRequest([{
            productId: 101,
            quantity: 0,
            installOption: 'none',
        }]))

        expect(response.status).toBe(400)
        expect(mocks.transaction).not.toHaveBeenCalled()
    })

    it('rejects duplicate products', async () => {
        const response = await POST(createRequest([
            { productId: 101, quantity: 1, installOption: 'none' },
            { productId: 101, quantity: 1, installOption: 'install' },
        ]))
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.code).toBe('DUPLICATE_PRODUCT')
        expect(mocks.transaction).not.toHaveBeenCalled()
    })

    it('rejects inactive products', async () => {
        mocks.findProducts.mockResolvedValue([{ ...availableProduct, is_active: false }])

        const response = await POST(createRequest([{
            productId: 101,
            quantity: 1,
            installOption: 'none',
        }]))
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.code).toBe('PRODUCT_UNAVAILABLE')
        expect(mocks.createOrder).not.toHaveBeenCalled()
    })

    it('sends products without a valid price to the quote flow', async () => {
        mocks.findProducts.mockResolvedValue([{
            ...availableProduct,
            price: null,
            sale_price: null,
            online_discount_amount: null,
        }])

        const response = await POST(createRequest([{
            productId: 101,
            quantity: 1,
            installOption: 'none',
        }]))
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.code).toBe('PRODUCT_REQUIRES_QUOTE')
        expect(mocks.createOrder).not.toHaveBeenCalled()
    })

    it('wraps the product read and order write in one transaction', async () => {
        mocks.createOrder.mockRejectedValueOnce(new Error('write failed'))

        const response = await POST(createRequest([{
            productId: 101,
            quantity: 1,
            installOption: 'none',
        }]))

        expect(response.status).toBe(500)
        expect(mocks.transaction).toHaveBeenCalledTimes(1)
        expect(mocks.loggerError).toHaveBeenCalledWith(
            'Order creation failed',
            expect.objectContaining({ route: 'POST /api/orders' }),
        )
    })
})
