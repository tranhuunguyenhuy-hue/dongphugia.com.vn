import { requirePermission } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
    try {
        await requirePermission('products:read')
    } catch (e) {
        redirect('/admin') // Redirect back to dashboard if no permission
    }
    
    return children
}
