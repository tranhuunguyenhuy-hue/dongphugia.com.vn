import type { NextRequest } from 'next/server'

// In-memory sliding window rate limiter
// Safe for Vercel single-instance deployments.
// Note: resets on cold start — acceptable for anti-abuse (not billing-critical).

interface WindowEntry {
    timestamps: number[]
}

class RateLimiter {
    private store = new Map<string, WindowEntry>()

    /**
     * Check if the given key is within rate limits.
     * Uses a sliding window algorithm.
     *
     * @param key       Unique identifier (e.g., "ip:route")
     * @param maxReqs   Max allowed requests in the window
     * @param windowMs  Window duration in milliseconds
     * @returns true if allowed, false if rate limited
     */
    isAllowed(key: string, maxReqs: number, windowMs: number): boolean {
        const now = Date.now()
        const entry = this.store.get(key)
        // Slide the window: remove timestamps older than windowMs
        const timestamps = (entry?.timestamps ?? []).filter(t => now - t < windowMs)

        if (timestamps.length >= maxReqs) {
            // Update store with cleaned timestamps (don't add new one)
            this.store.set(key, { timestamps })
            return false
        }

        timestamps.push(now)
        this.store.set(key, { timestamps })
        return true
    }

    /**
     * How many requests remain in the current window.
     */
    remaining(key: string, maxReqs: number, windowMs: number): number {
        const now = Date.now()
        const entry = this.store.get(key)
        const active = (entry?.timestamps ?? []).filter(t => now - t < windowMs)
        return Math.max(0, maxReqs - active.length)
    }
}

// Singleton — shared across all route invocations in the same process
export const rateLimiter = new RateLimiter()

/**
 * Extract the real client IP from Vercel's x-forwarded-for header.
 * Falls back to 'unknown' (still rate-limited as a group).
 */
export function getClientIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }
    return 'unknown'
}

// Rate limit configs per route
export const RATE_LIMITS = {
    // Public lookup: 10 req/min per IP
    quoteGet: { maxReqs: 10, windowMs: 60_000 },
    // Quote submission: 5 req/min per IP (anti-spam)
    quotePost: { maxReqs: 5, windowMs: 60_000 },
} as const
