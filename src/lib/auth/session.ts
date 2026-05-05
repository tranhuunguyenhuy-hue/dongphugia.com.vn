import { createHash, randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import type { AdminRole } from './permissions'

// Session duration: 8 hours (configurable via SESSION_HOURS env)
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS ?? '8', 10)
export const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000

export const ADMIN_SESSION_COOKIE = 'dpg-admin-session'

export interface SessionUser {
    id: number
    email: string
    name: string
    role: AdminRole
    avatarUrl?: string | null
}

/** Generate a cryptographically random session token (64 hex chars). */
export function generateSessionToken(): string {
    return randomBytes(32).toString('hex')
}

/** Hash a session token for safe DB storage (SHA-256). */
export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

/**
 * Create a new DB session for a user.
 * Returns the plain token (to be stored in cookie).
 */
export async function createSession(
    userId: number,
    ipAddress?: string,
    userAgent?: string
): Promise<string> {
    // Clean up expired sessions for this user first
    await prisma.admin_sessions.deleteMany({
        where: { user_id: userId, expires_at: { lt: new Date() } },
    })

    const token = generateSessionToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + SESSION_MS)

    await prisma.admin_sessions.create({
        data: {
            user_id: userId,
            token_hash: tokenHash,
            ip_address: ipAddress,
            user_agent: userAgent,
            expires_at: expiresAt,
        },
    })

    // Update last_login_at
    await prisma.admin_users.update({
        where: { id: userId },
        data: { last_login_at: new Date() },
    })

    return token
}

/**
 * Verify a session token from cookie.
 * Returns the user if valid, null otherwise.
 */
export async function verifySession(token: string): Promise<SessionUser | null> {
    if (!token) return null

    const tokenHash = hashToken(token)

    const session = await prisma.admin_sessions.findUnique({
        where: { token_hash: tokenHash },
        include: {
            user: {
                select: { id: true, email: true, name: true, role: true, avatar_url: true, is_active: true },
            },
        },
    })

    if (!session) return null
    if (session.expires_at < new Date()) {
        // Expired — clean up
        await prisma.admin_sessions.delete({ where: { token_hash: tokenHash } })
        return null
    }
    if (!session.user.is_active) return null

    return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role as AdminRole,
        avatarUrl: session.user.avatar_url,
    }
}

/** Delete a session (logout). */
export async function deleteSession(token: string): Promise<void> {
    const tokenHash = hashToken(token)
    await prisma.admin_sessions
        .delete({ where: { token_hash: tokenHash } })
        .catch(() => {}) // Silently ignore if already deleted
}

/** Delete all sessions for a user (force logout all devices). */
export async function deleteAllSessions(userId: number): Promise<void> {
    await prisma.admin_sessions.deleteMany({ where: { user_id: userId } })
}
