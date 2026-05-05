import { cookies } from 'next/headers'
import { verifySession, ADMIN_SESSION_COOKIE, type SessionUser } from './session'

/**
 * Get the currently authenticated admin user from the session cookie.
 * Returns null if not authenticated or session is expired.
 * Use this in Server Components and Server Actions.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    if (!token) return null
    return verifySession(token)
}

/**
 * Require authentication. Throws a redirect-friendly error if not authenticated.
 * Use at the top of protected Server Actions.
 */
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('UNAUTHORIZED')
    }
    return user
}

/**
 * Require a specific role. Throws if not authenticated or insufficient role.
 */
export async function requireRole(role: string): Promise<SessionUser> {
    const user = await requireAuth()
    const hierarchy = { admin: 3, sale_manager: 2, sale: 1 }
    const userLevel = hierarchy[user.role as keyof typeof hierarchy] ?? 0
    const requiredLevel = hierarchy[role as keyof typeof hierarchy] ?? 99
    if (userLevel < requiredLevel) {
        throw new Error('FORBIDDEN')
    }
    return user
}
