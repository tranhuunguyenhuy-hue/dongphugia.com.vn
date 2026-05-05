'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const orderSchema = z.object({
    customer_name: z.string().min(1, 'Tên khách hàng là bắt buộc').max(200),
    customer_phone: z.string().min(9, 'Số điện thoại không hợp lệ').max(20),
    customer_email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
    customer_address: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    payment_method: z.string().max(50).optional().nullable(),
    items: z.array(z.object({
        product_id: z.coerce.number().int().positive(),
        product_name: z.string().min(1),
        product_sku: z.string().min(1),
        quantity: z.coerce.number().int().positive().default(1),
        unit_price: z.coerce.number().min(0),
    })).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Fix #3: Entropy tăng từ 4 → 6 digits để giảm collision probability
function generateOrderNumber(): string {
    const now = new Date()
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(100000 + Math.random() * 900000)
    return `DPG${yyyymmdd}${rand}`
}

// ─── CREATE ORDER ─────────────────────────────────────────────────────────────

export async function createOrder(data: unknown) {
    const validated = orderSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data

    const subtotal = d.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
    const total = subtotal // No shipping fee for now (always 0)

    try {
        const order = await prisma.orders.create({
            data: {
                order_number: generateOrderNumber(),
                customer_name: d.customer_name,
                customer_phone: d.customer_phone,
                customer_email: d.customer_email || null,
                customer_address: d.customer_address || null,
                note: d.note || null,
                payment_method: d.payment_method || null,
                subtotal,
                shipping_fee: 0,
                total,
                status: 'pending',
                payment_status: 'unpaid',
                order_items: {
                    create: d.items.map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name ? String(item.product_name).slice(0, 500) : 'Sản phẩm',
                        product_sku: item.product_sku ? String(item.product_sku).slice(0, 100) : 'N/A',
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.unit_price * item.quantity,
                    })),
                },
            },
        })
        revalidatePath('/admin/orders')
        return { success: true, id: order.id, orderNumber: order.order_number }
    } catch (err: any) {
        return { message: 'Lỗi tạo đơn hàng: ' + err.message }
    }
}

// ─── UPDATE ORDER STATUS ──────────────────────────────────────────────────────

export async function updateOrderStatus(id: number, status: string) {
    const validStatuses = ['pending', 'received', 'confirmed', 'inventory_check', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
        return { message: 'Trạng thái không hợp lệ' }
    }
    try {
        await prisma.orders.update({
            where: { id },
            data: { status, updated_at: new Date() },
        })
        revalidatePath('/admin/orders')
        revalidatePath(`/admin/orders/${id}`)
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi cập nhật trạng thái: ' + err.message }
    }
}

export async function updatePaymentStatus(id: number, paymentStatus: string) {
    const validStatuses = ['unpaid', 'paid', 'refunded']
    if (!validStatuses.includes(paymentStatus)) {
        return { message: 'Trạng thái thanh toán không hợp lệ' }
    }
    try {
        await prisma.orders.update({
            where: { id },
            data: { payment_status: paymentStatus, updated_at: new Date() },
        })
        revalidatePath('/admin/orders')
        revalidatePath(`/admin/orders/${id}`)
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi cập nhật thanh toán: ' + err.message }
    }
}

// ─── GET ORDER BY NUMBER (for customer tracking) ──────────────────────────────

export async function getOrderByNumber(orderNumber: string) {
    return prisma.orders.findUnique({
        where: { order_number: orderNumber },
        include: {
            order_items: {
                include: {
                    products: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            image_main_url: true,
                            categories: { select: { slug: true } },
                        },
                    },
                },
            },
        },
    })
}

// ─── ADMIN: LIST ORDERS ───────────────────────────────────────────────────────

export async function getAdminOrders(params: {
    status?: string
    payment_status?: string
    search?: string
    page?: number
    pageSize?: number
}) {
    const { status, payment_status, search, page = 1, pageSize = 25 } = params

    const where: Prisma.ordersWhereInput = {
        ...(status && { status }),
        ...(payment_status && { payment_status }),
        ...(search && {
            OR: [
                { order_number: { contains: search, mode: 'insensitive' } },
                { customer_name: { contains: search, mode: 'insensitive' } },
                { customer_phone: { contains: search } },
            ],
        }),
    }

    const [orders, total] = await Promise.all([
        prisma.orders.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                order_number: true,
                customer_name: true,
                customer_phone: true,
                customer_email: true,
                note: true,
                total: true,
                status: true,
                payment_status: true,
                payment_method: true,
                created_at: true,
                _count: { select: { order_items: true } },
                order_items: {
                    select: {
                        id: true,
                        product_name: true,
                        product_sku: true,
                        quantity: true,
                        unit_price: true,
                        total_price: true,
                    },
                    take: 3, // Preview first 3 items in list view
                },
            },
        }),
        prisma.orders.count({ where }),
    ])

    return {
        orders: orders.map(o => ({
            ...o,
            total: Number(o.total),
            order_items: o.order_items.map(item => ({
                ...item,
                unit_price: Number(item.unit_price),
                total_price: Number(item.total_price),
            })),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    }
}

// ─── ADMIN: ORDER DETAIL ──────────────────────────────────────────────────────

export async function getAdminOrderById(id: number) {
    const order = await prisma.orders.findUnique({
        where: { id },
        include: {
            order_items: {
                include: {
                    products: {
                        select: { id: true, name: true, image_main_url: true, categories: { select: { slug: true } } }
                    }
                },
            },
        },
    })
    if (!order) return null
    return {
        ...order,
        subtotal: Number(order.subtotal),
        shipping_fee: Number(order.shipping_fee),
        total: Number(order.total),
        order_items: order.order_items.map(item => ({
            ...item,
            unit_price: Number(item.unit_price),
            total_price: Number(item.total_price),
        })),
    }
}

// ─── ORDER STATS ──────────────────────────────────────────────────────────────

export async function getOrderStats() {
    const [total, pending, processing, delivered, revenue] = await Promise.all([
        prisma.orders.count(),
        prisma.orders.count({ where: { status: 'pending' } }),
        prisma.orders.count({ where: { status: { in: ['received', 'confirmed', 'inventory_check'] } } }),
        prisma.orders.count({ where: { status: 'completed' } }),
        prisma.orders.aggregate({
            _sum: { total: true },
            where: { status: 'completed', payment_status: 'paid' },
        }),
    ])
    return {
        total,
        pending,
        processing,
        delivered,
        revenue: Number(revenue._sum.total || 0),
    }
}

// ─── CREATE QUOTE FROM ORDER ──────────────────────────────────────────────────

export async function createQuoteFromOrder(orderId: number) {
    const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: { order_items: true }
    })
    
    if (!order) return { success: false, error: 'Không tìm thấy đơn hàng' }

    try {
        const quote = await prisma.quote_requests.create({
            data: {
                quote_number: `Q-${order.order_number}`,
                name: order.customer_name,
                phone: order.customer_phone,
                email: order.customer_email || null,
                message: `Tạo từ đơn hàng ${order.order_number}`,
                status: 'resolved',
                shipping_fee: order.shipping_fee,
                quote_items: {
                    create: order.order_items.map(item => ({
                        product_id: item.product_id,
                        admin_unit_price: item.unit_price,
                        admin_quantity: item.quantity,
                    }))
                }
            }
        })
        return { success: true, quoteId: quote.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── UPDATE ORDER DETAILS (Builder) ──────────────────────────────────────────

export async function updateOrderData(orderId: number, data: any) {
    try {
        const items = data.items || []
        const subtotal = items.reduce((acc: number, item: any) => {
            const price = item.unit_price ?? 0
            const qty = item.quantity ?? 1
            return acc + (price * qty)
        }, 0)

        const vatRate = data.vat_rate || 0
        const vatAmount = subtotal * (vatRate / 100)
        const shippingFee = Number(data.shipping_fee) || 0
        const discount = Number(data.discount) || 0
        const total = subtotal + vatAmount + shippingFee - discount

        // Update order
        await prisma.orders.update({
            where: { id: orderId },
            data: {
                vat_rate: vatRate,
                shipping_fee: shippingFee,
                discount: discount,
                note: data.note,
                subtotal: subtotal,
                total: total,
            }
        })

        // Update items
        for (const item of items) {
            await prisma.order_items.update({
                where: { id: item.id },
                data: {
                    unit_price: item.unit_price,
                    quantity: item.quantity,
                    total_price: Number(item.unit_price) * Number(item.quantity)
                }
            })
        }

        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to update order data:', error)
        return { success: false, error: 'Lỗi server khi lưu đơn hàng: ' + error.message }
    }
}
