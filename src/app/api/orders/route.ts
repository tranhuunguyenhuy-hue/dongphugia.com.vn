import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Generate order number: DPG-YYYYMMDD-XXXX
function generateOrderNumber(): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    return `DPG-${date}-${rand}`
}

export async function POST(req: NextRequest) {
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
            (sum: number, item: { price: number | null; quantity: number }) =>
                sum + (item.price ?? 0) * item.quantity,
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
                            }) => ({
                                product_id: item.productId,
                                product_name: item.name,
                                product_sku: item.sku,
                                quantity: item.quantity,
                                unit_price: item.price ?? 0,
                                total_price: (item.price ?? 0) * item.quantity,
                            })),
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
