/**
 * admin-auth.ts — Backward-compatible auth layer.
 *
 * Sprint 1 (old): Single ADMIN_PASSWORD via HMAC cookie.
 * Sprint 2 (new): Per-user DB sessions via admin_sessions table.
 *
 * This file provides a unified interface so AdminLayout and other consumers
 * don't need to change their import paths.
 */
import { getCurrentUser } from '@/lib/auth/get-current-user'
import type { SessionUser } from '@/lib/auth/session'

export { ADMIN_SESSION_COOKIE } from '@/lib/auth/session'
export type { SessionUser }

/**
 * Verify if the current request has a valid admin session.
 * Returns true/false for simple authenticated checks (backward compat).
 */
export async function verifyAdminSession(): Promise<boolean> {
    const user = await getCurrentUser()
    return user !== null
}

/**
 * Get the full session user object (new API).
 * Prefer this over verifyAdminSession() when you need user data.
 */
export { getCurrentUser }
