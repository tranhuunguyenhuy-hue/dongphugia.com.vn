'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, deleteSession, ADMIN_SESSION_COOKIE, SESSION_MS } from '@/lib/auth/session'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import prisma from '@/lib/prisma'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

// Simple in-memory rate limiter (per server instance)
// For multi-instance deployments, use Redis instead
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()

function checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const record = loginAttempts.get(ip)

    if (!record) {
        loginAttempts.set(ip, { count: 1, firstAttempt: now })
        return true
    }

    // Reset window if lockout period passed
    if (now - record.firstAttempt > LOCKOUT_MS) {
        loginAttempts.set(ip, { count: 1, firstAttempt: now })
        return true
    }

    if (record.count >= MAX_LOGIN_ATTEMPTS) return false

    record.count++
    return true
}

function clearRateLimit(ip: string): void {
    loginAttempts.delete(ip)
}

export async function loginAction(
    _prevState: { error?: string } | null,
    formData: FormData
): Promise<{ error: string }> {
    const headerStore = await headers()
    const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Rate limiting check
    if (!checkRateLimit(ip)) {
        return { error: 'Quá nhiều lần thử. Vui lòng đợi 15 phút và thử lại.' }
    }

    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const password = formData.get('password') as string

    if (!email || !password) {
        return { error: 'Vui lòng nhập đầy đủ email và mật khẩu.' }
    }

    // Look up user
    const user = await prisma.admin_users.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true, password_hash: true, is_active: true },
    })

    // Constant-time response (prevent user enumeration)
    const isValid = user ? await verifyPassword(password, user.password_hash) : false

    if (!user || !isValid) {
        return { error: 'Email hoặc mật khẩu không đúng.' }
    }

    if (!user.is_active) {
        return { error: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.' }
    }

    // Clear rate limit on success
    clearRateLimit(ip)

    // Create DB session
    const userAgent = headerStore.get('user-agent') ?? undefined
    const token = await createSession(user.id, ip, userAgent)

    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: Math.floor(SESSION_MS / 1000),
        path: '/',
    })

    redirect('/admin')
}

export async function logoutAction(): Promise<void> {
    const cookieStore = await cookies()
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

    if (token) {
        await deleteSession(token)
    }

    cookieStore.delete(ADMIN_SESSION_COOKIE)
    redirect('/admin/login')
}

/** Get current user (re-export for convenience in Server Components) */
export { getCurrentUser }
