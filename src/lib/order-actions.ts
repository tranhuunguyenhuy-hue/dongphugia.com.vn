'use server'

import prisma from '@/lib/prisma'
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

function generateOrderNumber(): string {
    const now = new Date()
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    return `DPG${yyyymmdd}${rand}`
}

// ─── CREATE ORDER ─────────────────────────────────────────────────────────────

export async function createOrder(data: any) {
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
                        product_name: item.product_name,
                        product_sku: item.product_sku,
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
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled']
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

    const where: any = {
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
                total: true,
                status: true,
                payment_status: true,
                payment_method: true,
                created_at: true,
                _count: { select: { order_items: true } },
            },
        }),
        prisma.orders.count({ where }),
    ])

    return {
        orders: orders.map(o => ({ ...o, total: Number(o.total) })),
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
        prisma.orders.count({ where: { status: { in: ['confirmed', 'processing', 'shipping'] } } }),
        prisma.orders.count({ where: { status: 'delivered' } }),
        prisma.orders.aggregate({
            _sum: { total: true },
            where: { status: 'delivered', payment_status: 'paid' },
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
