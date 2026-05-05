import { getAdminOrderById } from '@/lib/order-actions'
import { notFound } from 'next/navigation'
import { OrderBuilderClient } from './order-builder-client'

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

    return <OrderBuilderClient order={order} />
}

