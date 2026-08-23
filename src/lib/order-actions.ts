'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser, requireAuth, requirePermission } from '@/lib/auth/get-current-user'
import { can } from '@/lib/auth/permissions'
import { generateOrderNumber } from '@/lib/utils'
import { toWriteFreezeActionResult } from '@/lib/write-freeze'

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

// generateOrderNumber() is imported from @/lib/utils (LEO-421: unified format DPG-YYYYMMDD-XXXXXX)

async function requireAssignedOrderAccess(orderId: number, userId: number) {
    const order = await prisma.orders.findUnique({
        where: { id: orderId },
        select: { assigned_to: true },
    })

    if (!order) return { allowed: false, missing: true }
    return { allowed: order.assigned_to === userId, missing: false }
}

async function requireOrderActionAccess(orderId: number, permission: Parameters<typeof requirePermission>[0]) {
    const currentUser = await requirePermission(permission)
    if (can(currentUser.role, 'orders:read')) return currentUser

    const access = await requireAssignedOrderAccess(orderId, currentUser.id)
    if (!access.allowed) {
        throw new Error(access.missing ? 'ORDER_NOT_FOUND' : 'FORBIDDEN: Order is not assigned to current user')
    }

    return currentUser
}

// ─── CREATE ORDER ─────────────────────────────────────────────────────────────

export async function createOrder(data: unknown) {
    await requirePermission('orders:edit')

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
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi tạo đơn hàng: ' + err.message }
    }
}

// ─── UPDATE ORDER STATUS ──────────────────────────────────────────────────────

export async function updateOrderStatus(id: number, status: string) {
    await requireOrderActionAccess(id, 'orders:update_status')

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
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi cập nhật trạng thái: ' + err.message }
    }
}

export async function updatePaymentStatus(id: number, paymentStatus: string) {
    await requirePermission('orders:edit')

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
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
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

    const currentUser = await requireAuth()
    const isSaleOnly = !can(currentUser.role, 'orders:read')

    const where: Prisma.ordersWhereInput = {
        ...(isSaleOnly && { assigned_to: currentUser.id }),
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
                assigned_to: true,
                assigned_at: true,
                assigned_user: { select: { name: true, email: true } },
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
            order_items: o.order_items?.map((item: any) => ({
                ...item,
                unit_price: Number(item.unit_price),
                total_price: Number(item.total_price),
            })) || [],
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    }
}

// ─── ADMIN: ORDER DETAIL ──────────────────────────────────────────────────────

export async function getAdminOrderById(id: number) {
    const currentUser = await requireAuth()
    const restrictToAssigned = !can(currentUser.role, 'orders:read')

    const order = await prisma.orders.findUnique({
        where: { id },
        include: {
            assigned_user: { select: { name: true, email: true } },
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
    if (restrictToAssigned && order.assigned_to !== currentUser.id) return null

    return {
        ...order,
        subtotal: Number(order.subtotal),
        shipping_fee: Number(order.shipping_fee),
        total: Number(order.total),
        order_items: order.order_items?.map((item: any) => ({
            ...item,
            unit_price: Number(item.unit_price),
            total_price: Number(item.total_price),
        })) || [],
    }
}

// ─── ORDER STATS ──────────────────────────────────────────────────────────────

export async function getOrderStats() {
    const currentUser = await requireAuth()
    const assignedOnly = !can(currentUser.role, 'dashboard:read')
    const assignedWhere = assignedOnly ? { assigned_to: currentUser.id } : {}

    const [total, pending, processing, delivered, revenue] = await Promise.all([
        prisma.orders.count({ where: assignedWhere }),
        prisma.orders.count({ where: { ...assignedWhere, status: 'pending' } }),
        prisma.orders.count({ where: { ...assignedWhere, status: { in: ['received', 'confirmed', 'inventory_check'] } } }),
        prisma.orders.count({ where: { ...assignedWhere, status: 'completed' } }),
        prisma.orders.aggregate({
            _sum: { total: true },
            where: { ...assignedWhere, status: 'completed', payment_status: 'paid' },
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
    await requireOrderActionAccess(orderId, 'quotes:create')

    const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: { order_items: true }
    })
    
    if (!order) return { success: false, error: 'Không tìm thấy đơn hàng' }

    // R5 cannot derive historical commerce mode/Availability from the current
    // order-line schema. Stop rather than fabricating snapshot facts or reading
    // a mutable Product as the historical source.
    return {
        success: false,
        error: 'Chưa thể chuyển đơn hàng thành báo giá: dòng đơn hàng chưa có commerce snapshot bất biến.',
    }

}

// ─── UPDATE ORDER DETAILS (Builder) ──────────────────────────────────────────

type OrderUpdateData = {
    items?: Array<{ id: number; unit_price: number; quantity: number }>
    vat_rate?: number
    shipping_fee?: number
    discount?: number
    note?: string | null
}

export async function updateOrderData(orderId: number, data: OrderUpdateData) {
    await requirePermission('orders:edit')

    try {
        const items = data.items || []
        const subtotal = items.reduce((acc: number, item) => {
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
    } catch (error: unknown) {
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error('Failed to update order data:', error)
        return { success: false, error: 'Lỗi server khi lưu đơn hàng: ' + (error instanceof Error ? error.message : String(error)) }
    }
}

// ─── ASSIGN ORDER ─────────────────────────────────────────────────────────────

export async function assignOrder(orderId: number, userId: number | null) {
    try {
        await requirePermission('orders:assign')
        
        await prisma.orders.update({
            where: { id: orderId },
            data: {
                assigned_to: userId,
                assigned_at: userId ? new Date() : null
            }
        })
        
        // Log to audit (optional for later, but handled here)
        const currentUser = await getCurrentUser()
        await prisma.audit_logs.create({
            data: {
                user_id: currentUser?.id,
                action: userId ? 'ASSIGN_ORDER' : 'UNASSIGN_ORDER',
                entity_type: 'orders',
                entity_id: orderId,
                new_value: { assigned_to: userId }
            }
        })

        revalidatePath('/admin/orders')
        revalidatePath(`/admin/orders/${orderId}`)
        return { success: true }
    } catch (error: unknown) {
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error('Failed to assign order:', error)
        return { success: false, error: 'Lỗi khi giao đơn hàng: ' + (error instanceof Error ? error.message : String(error)) }
    }
}
