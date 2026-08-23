import { requirePermission } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function PimLayout({ children }: { children: React.ReactNode }) {
    try {
        await requirePermission('brands:read')
    } catch {
        redirect('/admin')
    }
    return children
}
