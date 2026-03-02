import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

export const ADMIN_SESSION_COOKIE = 'dpg-admin-session'

export function getExpectedToken(): string | null {
    const secret = process.env.AUTH_SECRET
    if (!secret) return null // AUTH_SECRET not configured — no valid sessions possible
    const password = process.env.ADMIN_PASSWORD ?? ''
    return createHmac('sha256', secret).update(password).digest('hex')
}

export async function verifyAdminSession(): Promise<boolean> {
    const expected = getExpectedToken()
    if (!expected) return false
    const cookieStore = await cookies()
    const session = cookieStore.get(ADMIN_SESSION_COOKIE)
    if (!session?.value) return false
    return session.value === expected
}
