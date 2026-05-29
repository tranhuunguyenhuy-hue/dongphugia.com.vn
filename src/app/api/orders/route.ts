import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { rateLimiter, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { generateOrderNumber } from '@/lib/utils'

export async function POST(req: NextRequest) {
    // Rate limiting: 5 requests per minute per IP
    const ip = getClientIp(req)
    const { maxReqs, windowMs } = RATE_LIMITS.ordersPost
    if (!rateLimiter.isAllowed(`orders:${ip}`, maxReqs, windowMs)) {
        return NextResponse.json(
            { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
            { status: 429, headers: { 'Retry-After': '60' } }
        )
    }

    try {
        const body = await req.json()
        const {
            customer_name,
            customer_phone,
            customer_email,
            customer_address,
            note,
            items, // CartItem[]
        } = body

        // Validation
        if (!customer_name || !customer_phone) {
            return NextResponse.json(
                { error: 'Vui lòng cung cấp họ tên và số điện thoại.' },
                { status: 400 }
            )
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: 'Giỏ hàng trống.' },
                { status: 400 }
            )
        }

        // Calculate totals
        const subtotal = items.reduce(
            (sum: number, item: { price: number | null; quantity: number; finalPrice?: number }) =>
                sum + ((item.finalPrice ?? item.price) ?? 0) * item.quantity,
            0
        )

        // Retry loop for unique order number collision
        let order = null
        let attempts = 0
        while (!order && attempts < 5) {
            attempts++
            const orderNumber = generateOrderNumber()
            try {
                order = await prisma.orders.create({
                    data: {
                        order_number: orderNumber,
                        customer_name: String(customer_name).slice(0, 200),
                        customer_phone: String(customer_phone).slice(0, 20),
                        customer_email: customer_email ? String(customer_email).slice(0, 200) : null,
                        customer_address: customer_address ? String(customer_address) : null,
                        note: note ? String(note) : null,
                        subtotal,
                        total: subtotal,
                        status: 'pending',
                        payment_status: 'unpaid',
                        order_items: {
                            create: items.map((item: {
                                productId: number
                                name: string
                                sku: string
                                quantity: number
                                price: number | null
                                finalPrice?: number
                                installOption?: string
                                onlineDiscountAmount?: number
                            }) => {
                                let displayName = item.name ? String(item.name) : 'Sản phẩm';
                                const options = [];
                                if (item.installOption === 'install') options.push('Cần Lắp Đặt');
                                if (item.installOption === 'replace') options.push('Tháo dỡ & Lắp Đặt');
                                if (item.onlineDiscountAmount && item.onlineDiscountAmount > 0) options.push(`Giảm Online ${item.onlineDiscountAmount}đ`);
                                
                                if (options.length > 0) {
                                    displayName += ` (${options.join(' | ')})`;
                                }
                                
                                const finalItemPrice = item.finalPrice ?? item.price ?? 0;
                                
                                return {
                                    product_id: item.productId,
                                    product_name: displayName.slice(0, 500),
                                    product_sku: item.sku ? String(item.sku).slice(0, 100) : 'N/A',
                                    quantity: item.quantity,
                                    unit_price: finalItemPrice,
                                    total_price: finalItemPrice * item.quantity,
                                };
                            }),
                        },
                    },
                })
            } catch (err: any) {
                // P2002 = unique constraint violation → retry
                if (err?.code === 'P2002') continue
                throw err
            }
        }

        if (!order) {
            return NextResponse.json({ error: 'Không thể tạo mã đơn hàng. Vui lòng thử lại.' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            order_number: order.order_number,
            order_id: order.id,
        })
    } catch (err) {
        console.error('[POST /api/orders]', err)
        return NextResponse.json({ error: 'Lỗi server. Vui lòng thử lại.' }, { status: 500 })
    }
}
