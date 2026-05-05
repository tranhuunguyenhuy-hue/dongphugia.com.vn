import { requirePermission } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function QuoteRequestsLayout({ children }: { children: React.ReactNode }) {
    try {
        await requirePermission('quotes:read')
    } catch (e) {
        redirect('/admin')
    }
    return children
}
