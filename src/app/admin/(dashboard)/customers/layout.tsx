import { requirePermission } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
    try {
        await requirePermission('customers:read')
    } catch (e) {
        redirect('/admin')
    }
    return children
}
