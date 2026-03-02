import { verifyAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import { Package2 } from 'lucide-react'

export const metadata = {
    title: 'Đăng nhập — Đông Phú Gia Admin',
}

export default async function LoginPage() {
    const isAuthenticated = await verifyAdminSession()
    if (isAuthenticated) redirect('/admin')

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-full max-w-sm px-4">
                <div className="flex flex-col items-center gap-2 mb-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700 text-white shadow-sm">
                        <Package2 className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground">Đông Phú Gia</h1>
                    <p className="text-sm text-muted-foreground">Trang quản trị</p>
                </div>

                <div className="bg-white border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-base font-semibold mb-4 text-foreground">Đăng nhập</h2>
                    <LoginForm />
                </div>
            </div>
        </div>
    )
}
