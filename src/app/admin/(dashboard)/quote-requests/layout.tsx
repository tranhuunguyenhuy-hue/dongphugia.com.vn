import { getCurrentUser } from '@/lib/auth/get-current-user'
import { can } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'

export default async function QuoteRequestsLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser()
    if (!user) redirect('/admin/login')

    if (!can(user.role, 'quotes:read') && !can(user.role, 'quotes:read_assigned')) {
        redirect('/admin')
    }

    return children
}
