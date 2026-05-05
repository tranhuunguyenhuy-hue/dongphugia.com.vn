'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function saveCustomer(data: {
    id?: number
    full_name: string
    phone: string
    email?: string
    notes?: string
    source?: string
}) {
    try {
        if (data.id) {
            // Update
            const updated = await prisma.customers.update({
                where: { id: data.id },
                data: {
                    full_name: data.full_name,
                    phone: data.phone,
                    email: data.email || null,
                    notes: data.notes || null,
                    source: data.source || 'MANUAL',
                    updated_at: new Date()
                }
            })
            revalidatePath('/admin/customers')
            return { success: true, id: updated.id }
        } else {
            // Check if phone exists
            const existing = await prisma.customers.findUnique({
                where: { phone: data.phone }
            })

            if (existing) {
                return { success: false, error: 'Số điện thoại này đã tồn tại trong hệ thống CSKH.' }
            }

            // Create
            const created = await prisma.customers.create({
                data: {
                    full_name: data.full_name,
                    phone: data.phone,
                    email: data.email || null,
                    notes: data.notes || null,
                    source: data.source || 'MANUAL',
                    last_interacted_at: new Date()
                }
            })
            revalidatePath('/admin/customers')
            return { success: true, id: created.id }
        }
    } catch (error) {
        console.error('Error saving customer:', error)
        return { success: false, error: 'Đã có lỗi xảy ra khi lưu khách hàng' }
    }
}
