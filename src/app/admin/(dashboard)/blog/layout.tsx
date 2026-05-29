import { requirePermission } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
    try {
        await requirePermission('blog:read')
    } catch (e) {
        redirect('/admin')
    }
    return children
}
