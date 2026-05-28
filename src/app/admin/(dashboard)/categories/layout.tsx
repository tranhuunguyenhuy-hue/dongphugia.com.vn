import { requirePermission } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function CategoriesLayout({ children }: { children: React.ReactNode }) {
    try {
        await requirePermission('categories:read')
    } catch (_e) {
        redirect('/admin')
    }
    return children
}
