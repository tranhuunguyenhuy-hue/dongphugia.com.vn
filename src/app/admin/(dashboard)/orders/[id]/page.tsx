import { getAdminOrderById } from '@/lib/order-actions'
import { notFound } from 'next/navigation'
import { OrderBuilderClient } from './order-builder-client'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
    const { id } = await params
    const orderId = Number(id)
    if (isNaN(orderId)) notFound()

    const order = await getAdminOrderById(orderId)
    if (!order) notFound()

    const staffMembers = await prisma.admin_users.findMany({
        where: { is_active: true, role: { in: ['admin', 'sale_manager', 'sale'] } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' }
    })

    return <OrderBuilderClient order={order} staffMembers={staffMembers} />
}

