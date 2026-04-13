import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

export const ADMIN_SESSION_COOKIE = 'dpg-admin-session'

// Session duration: default 8 hours (configurable via SESSION_HOURS env var)
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS ?? '8', 10)
export const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000

/**
 * Create an HMAC token bound to a specific issuedAt timestamp.
 * Token = HMAC-SHA256(AUTH_SECRET, ADMIN_PASSWORD + ":" + issuedAt)
 *
 * Binding to issuedAt means each login produces a unique token,
 * and expiry can be verified without a database or JWT library.
 */
export function createSessionToken(issuedAt: number): string {
    const secret = process.env.AUTH_SECRET!
    const password = process.env.ADMIN_PASSWORD ?? ''
    return createHmac('sha256', secret).update(`${password}:${issuedAt}`).digest('hex')
}

/**
 * Parse cookie value "<hmacToken>:<issuedAt>" into its components.
 * Returns null if format is invalid.
 */
function parseSessionCookie(value: string): { token: string; issuedAt: number } | null {
    const lastColon = value.lastIndexOf(':')
    if (lastColon === -1) return null

    const token = value.substring(0, lastColon)
    const issuedAtStr = value.substring(lastColon + 1)
    const issuedAt = parseInt(issuedAtStr, 10)

    if (!token || isNaN(issuedAt) || issuedAt <= 0) return null

    return { token, issuedAt }
}

/**
 * Verify the admin session cookie.
 * Checks both HMAC validity AND session age (< SESSION_HOURS).
 *
 * @returns true if session is valid and not expired
 */
export async function verifyAdminSession(): Promise<boolean> {
    if (!process.env.AUTH_SECRET) return false

    const cookieStore = await cookies()
    const session = cookieStore.get(ADMIN_SESSION_COOKIE)
    if (!session?.value) return false

    const parsed = parseSessionCookie(session.value)
    if (!parsed) return false

    const { token, issuedAt } = parsed

    // Check session age — reject if expired
    if (Date.now() - issuedAt > SESSION_MS) return false

    // Verify HMAC integrity — reject if tampered
    const expected = createSessionToken(issuedAt)
    return token === expected
}
