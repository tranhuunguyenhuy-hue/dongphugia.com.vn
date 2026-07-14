import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import prisma from '@/lib/prisma'
import { rateLimiter, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { generateOrderNumber } from '@/lib/utils'
import { ApiError, handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { calculateOrderUnitPrice } from '@/lib/order-pricing'

const MAX_ORDER_NUMBER_ATTEMPTS = 5

const orderRequestSchema = z.object({
    customer_name: z.string().trim().min(1).max(200),
    customer_phone: z.string().trim().min(9).max(20).regex(/^[\d\s+().-]+$/),
    customer_email: z.union([z.string().trim().email().max(200), z.literal('')]).optional(),
    customer_address: z.string().trim().max(1_000).optional(),
    note: z.string().trim().max(2_000).optional(),
    items: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
        installOption: z.enum(['none', 'install', 'replace']).default('none'),
    })).min(1).max(20),
})

type OrderRequest = z.infer<typeof orderRequestSchema>

function getPrismaErrorCode(error: unknown): string | undefined {
    return error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : undefined
}

function buildSnapshotName(
    productName: string,
    installOption: OrderRequest['items'][number]['installOption'],
    onlineDiscountAmount: number,
): string {
    const options: string[] = []

    if (installOption === 'install') options.push('Cần Lắp Đặt')
    if (installOption === 'replace') options.push('Tháo dỡ & Lắp Đặt')
    if (onlineDiscountAmount > 0) {
        options.push(`Giảm Online ${Math.round(onlineDiscountAmount)}đ`)
    }

    return options.length > 0
        ? `${productName} (${options.join(' | ')})`
        : productName
}

async function createAuthoritativeOrder(input: OrderRequest) {
    const productIds = input.items.map(item => item.productId)

    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
        try {
            return await prisma.$transaction(async transaction => {
                const products = await transaction.products.findMany({
                    where: { id: { in: productIds } },
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        price: true,
                        sale_price: true,
                        online_discount_amount: true,
                        is_active: true,
                        publication_status: true,
                        pdp_visibility: true,
                        sellable_status: true,
                    },
                })

                const productsById = new Map(products.map(product => [product.id, product]))
                const lineItems = input.items.map(item => {
                    const product = productsById.get(item.productId)

                    if (
                        !product
                        || !product.is_active
                        || product.publication_status !== 'public'
                        || product.pdp_visibility !== 'public'
                        || product.sellable_status !== 'sellable'
                    ) {
                        throw new ApiError(
                            400,
                            'Một hoặc nhiều sản phẩm không còn khả dụng để đặt hàng.',
                            'PRODUCT_UNAVAILABLE',
                        )
                    }

                    const onlineDiscountAmount = Number(product.online_discount_amount ?? 0)
                    const unitPrice = calculateOrderUnitPrice({
                        price: product.price === null ? null : Number(product.price),
                        salePrice: product.sale_price === null ? null : Number(product.sale_price),
                        onlineDiscountAmount,
                        installOption: item.installOption,
                    })

                    if (unitPrice === null) {
                        throw new ApiError(
                            400,
                            'Sản phẩm chưa có giá hợp lệ. Vui lòng yêu cầu báo giá.',
                            'PRODUCT_REQUIRES_QUOTE',
                        )
                    }

                    return {
                        product_id: product.id,
                        product_name: buildSnapshotName(
                            product.name,
                            item.installOption,
                            onlineDiscountAmount,
                        ).slice(0, 500),
                        product_sku: product.sku.slice(0, 100),
                        quantity: item.quantity,
                        unit_price: unitPrice,
                        total_price: unitPrice * item.quantity,
                    }
                })

                const subtotal = lineItems.reduce((sum, item) => sum + item.total_price, 0)

                return transaction.orders.create({
                    data: {
                        order_number: generateOrderNumber(),
                        customer_name: input.customer_name,
                        customer_phone: input.customer_phone,
                        customer_email: input.customer_email || null,
                        customer_address: input.customer_address || null,
                        note: input.note || null,
                        subtotal,
                        total: subtotal,
                        status: 'pending',
                        payment_status: 'unpaid',
                        order_items: { create: lineItems },
                    },
                })
            })
        } catch (error) {
            if (getPrismaErrorCode(error) === 'P2002') continue
            throw error
        }
    }

    throw new ApiError(
        503,
        'Không thể tạo mã đơn hàng. Vui lòng thử lại.',
        'ORDER_NUMBER_UNAVAILABLE',
    )
}

export async function POST(request: NextRequest) {
    const startedAt = Date.now()
    const ip = getClientIp(request)
    const { maxReqs, windowMs } = RATE_LIMITS.ordersPost

    if (!rateLimiter.isAllowed(`orders:${ip}`, maxReqs, windowMs)) {
        return NextResponse.json(
            { success: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
            { status: 429, headers: { 'Retry-After': '60' } },
        )
    }

    try {
        let body: unknown
        try {
            body = await request.json()
        } catch {
            throw new ApiError(400, 'Dữ liệu JSON không hợp lệ.', 'INVALID_JSON')
        }

        const input = orderRequestSchema.parse(body)
        const uniqueProductIds = new Set(input.items.map(item => item.productId))

        if (uniqueProductIds.size !== input.items.length) {
            throw new ApiError(
                400,
                'Mỗi sản phẩm chỉ được xuất hiện một lần trong đơn hàng.',
                'DUPLICATE_PRODUCT',
            )
        }

        const order = await createAuthoritativeOrder(input)

        logger.info('Order created', {
            route: 'POST /api/orders',
            duration_ms: Date.now() - startedAt,
            item_count: input.items.length,
        })

        return NextResponse.json({
            success: true,
            order_number: order.order_number,
            order_id: order.id,
            total: Number(order.total),
        })
    } catch (error) {
        if (error instanceof ApiError || error instanceof ZodError) {
            return handleApiError(error)
        }

        logger.error('Order creation failed', {
            route: 'POST /api/orders',
            duration_ms: Date.now() - startedAt,
            prisma_code: getPrismaErrorCode(error),
        })

        return NextResponse.json(
            { success: false, error: 'Lỗi server. Vui lòng thử lại.', code: 'INTERNAL_SERVER_ERROR' },
            { status: 500 },
        )
    }
}
