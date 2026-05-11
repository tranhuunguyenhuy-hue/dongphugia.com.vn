'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requirePermission, getCurrentUser } from '@/lib/auth/get-current-user'
import { hashPassword } from '@/lib/auth/password'
import type { AdminRole } from '@/lib/auth/permissions'

export async function saveUser(data: {
    id?: number
    username?: string
    email: string
    name: string
    password?: string
    role: AdminRole
    is_active: boolean
}) {
    try {
        await requirePermission('users:write')
        const currentUser = await getCurrentUser()

        // Prevent modifying other admins if you are not admin
        if (currentUser?.role !== 'admin' && data.role === 'admin') {
            return { success: false, error: 'Không thể tạo/sửa tài khoản Quản trị viên' }
        }

        if (data.id) {
            // Check if removing the last active admin
            if (!data.is_active || data.role !== 'admin') {
                const existing = await prisma.admin_users.findUnique({ where: { id: data.id } })
                if (existing?.role === 'admin') {
                    const activeAdmins = await prisma.admin_users.count({
                        where: { role: 'admin', is_active: true }
                    })
                    if (activeAdmins <= 1) {
                        return { success: false, error: 'Không thể vô hiệu hóa hoặc hạ quyền Quản trị viên cuối cùng' }
                    }
                }
            }

            const updateData: any = {
                username: data.username || null,
                email: data.email,
                name: data.name,
                role: data.role,
                is_active: data.is_active,
                updated_at: new Date()
            }
            if (data.password) {
                updateData.password_hash = await hashPassword(data.password)
            }

            await prisma.admin_users.update({
                where: { id: data.id },
                data: updateData
            })

            // Force logout if user is deactivated
            if (!data.is_active) {
                await prisma.admin_sessions.deleteMany({ where: { user_id: data.id } })
            }
        } else {
            if (!data.password) return { success: false, error: 'Mật khẩu là bắt buộc khi tạo mới' }
            
            // Check existing email
            const existing = await prisma.admin_users.findUnique({ where: { email: data.email } })
            if (existing) return { success: false, error: 'Email đã tồn tại' }

            if (data.username) {
                const existingUsername = await prisma.admin_users.findUnique({ where: { username: data.username } })
                if (existingUsername) return { success: false, error: 'Tên đăng nhập đã tồn tại' }
            }

            await prisma.admin_users.create({
                data: {
                    username: data.username || null,
                    email: data.email,
                    name: data.name,
                    role: data.role,
                    is_active: data.is_active,
                    password_hash: await hashPassword(data.password)
                }
            })
        }

        revalidatePath('/admin/users')
        return { success: true }
    } catch (error) {
        console.error('Save user error:', error)
        return { success: false, error: 'Đã có lỗi xảy ra' }
    }
}
