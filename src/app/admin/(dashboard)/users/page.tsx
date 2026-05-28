import prisma from '@/lib/prisma'
import { UsersClient } from './client-page'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ROLE_LABELS } from '@/lib/auth/permissions'

export const metadata = {
    title: 'Quản lý nhân viên | Admin',
}

export default async function UsersPage() {
    const users = await prisma.admin_users.findMany({
        orderBy: { created_at: 'desc' },
        select: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            is_active: true,
            last_login_at: true,
            created_at: true,
        }
    })

    return <UsersClient users={users} />
}
