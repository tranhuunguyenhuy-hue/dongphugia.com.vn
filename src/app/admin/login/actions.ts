'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_SESSION_COOKIE, createSessionToken, SESSION_MS } from '@/lib/admin-auth'

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

    // LEO-389: Bind token to current timestamp for session expiry support
    const issuedAt = Date.now()
    const token = createSessionToken(issuedAt)
    // Cookie value format: "<hmac>:<issuedAt>"
    const cookieValue = `${token}:${issuedAt}`

    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        // maxAge matches SESSION_MS — browser clears cookie after this duration
        maxAge: Math.floor(SESSION_MS / 1000),
        path: '/',
    })

    redirect('/admin')
}

export async function logoutAction() {
    const cookieStore = await cookies()
    cookieStore.delete(ADMIN_SESSION_COOKIE)
    redirect('/admin/login')
}
