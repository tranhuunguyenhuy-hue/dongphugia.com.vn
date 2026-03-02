'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_SESSION_COOKIE, getExpectedToken } from '@/lib/admin-auth'

export async function loginAction(
    _prevState: { error?: string } | null,
    formData: FormData
): Promise<{ error: string }> {
    const password = formData.get('password') as string
    const expectedPassword = process.env.ADMIN_PASSWORD

    if (!process.env.AUTH_SECRET) {
        return { error: 'Lỗi cấu hình server: AUTH_SECRET chưa được thiết lập.' }
    }

    if (!expectedPassword) {
        return { error: 'Lỗi cấu hình server: ADMIN_PASSWORD chưa được thiết lập.' }
    }

    if (!password || password !== expectedPassword) {
        return { error: 'Mật khẩu không đúng.' }
    }

    const token = getExpectedToken()!
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
    })

    redirect('/admin')
}

export async function logoutAction() {
    const cookieStore = await cookies()
    cookieStore.delete(ADMIN_SESSION_COOKIE)
    redirect('/admin/login')
}
