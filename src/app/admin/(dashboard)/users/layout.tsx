import { requirePermission } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
    try {
        await requirePermission('users:read')
    } catch (e) {
        redirect('/admin')
    }
    return children
}
