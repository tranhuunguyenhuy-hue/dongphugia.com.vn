'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requirePermission, getCurrentUser } from '@/lib/auth/get-current-user'

export async function updateQuoteData(quoteId: number, data: any) {
    try {
        await requirePermission('quotes:update')

        // Update quote
        await prisma.quote_requests.update({
            where: { id: quoteId },
            data: {
                vat_rate: data.vat_rate,
                shipping_fee: data.shipping_fee,
                admin_notes: data.admin_notes,
                status: 'resolved' // Moving to resolved status when they start working on it
            }
        })

        // Update items
        for (const item of data.items) {
            await prisma.quote_items.update({
                where: { id: item.id },
                data: {
                    admin_unit_price: item.admin_unit_price,
                    admin_quantity: item.admin_quantity
                }
            })
        }

        revalidatePath(`/admin/quote-requests/${quoteId}/builder`)
        return { success: true }
    } catch (error) {
        console.error('Failed to update quote data:', error)
        return { success: false, error: 'Lỗi server khi lưu báo giá' }
    }
}

export async function completeQuote(quoteId: number, data: any) {
    try {
        await requirePermission('quotes:update')

        // Save first
        await updateQuoteData(quoteId, data)

        // Find or create customer
        let customer = await prisma.customers.findUnique({
            where: { phone: data.phone }
        })

        if (!customer) {
            customer = await prisma.customers.create({
                data: {
                    full_name: data.name,
                    phone: data.phone,
                    email: data.email,
                    source: 'QUOTE_FORM',
                    notes: `Khách hàng từ yêu cầu báo giá #${data.quote_number || data.id}`
                }
            })
        } else {
            await prisma.customers.update({
                where: { id: customer.id },
                data: {
                    last_interacted_at: new Date(),
                    notes: customer.notes ? `${customer.notes}\n---\nNhận báo giá #${data.quote_number || data.id}` : `Nhận báo giá #${data.quote_number || data.id}`
                }
            })
        }

        // Complete quote and link customer
        await prisma.quote_requests.update({
            where: { id: quoteId },
            data: {
                status: 'completed', // Assuming we add a completed status or just resolved
                customer_id: customer.id,
                updated_at: new Date()
            }
        })

        revalidatePath('/admin/quote-requests')
        revalidatePath('/admin/customers')
        return { success: true }
    } catch (error) {
        console.error('Failed to complete quote:', error)
        return { success: false, error: 'Lỗi server khi hoàn thành báo giá' }
    }
}

export async function assignQuote(quoteId: number, userId: number | null) {
    try {
        await requirePermission('quotes:update')
        
        await prisma.quote_requests.update({
            where: { id: quoteId },
            data: {
                assigned_to: userId
            }
        })
        
        const currentUser = await getCurrentUser()
        await prisma.audit_logs.create({
            data: {
                user_id: currentUser?.id,
                action: userId ? 'ASSIGN_QUOTE' : 'UNASSIGN_QUOTE',
                entity_type: 'quote_requests',
                entity_id: quoteId,
                new_value: { assigned_to: userId }
            }
        })

        revalidatePath('/admin/quote-requests')
        revalidatePath(`/admin/quote-requests/${quoteId}/builder`)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to assign quote:', error)
        return { success: false, error: 'Lỗi khi giao báo giá: ' + error.message }
    }
}
