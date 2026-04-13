// ================================================================
// LEO-391: Structured Production Logging
// Replaces perf-logger.ts (dev-only console.time)
// JSON format: compatible with Vercel Log Drain / Datadog / Sentry
// ================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
    level: LogLevel
    message: string
    timestamp: string
    route?: string
    duration_ms?: number
    [key: string]: unknown
}

const isDev = process.env.NODE_ENV === 'development'

/**
 * Core logging function — outputs JSON in production, readable in dev.
 */
function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
    }

    if (isDev) {
        // Human-readable in development
        const emoji = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level]
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
        console.log(`${emoji} [${level.toUpperCase()}] ${message}${metaStr}`)
    } else {
        // JSON in production — parseable by Vercel Log Drain
        console.log(JSON.stringify(entry))
    }
}

/**
 * Structured logger with convenience methods.
 *
 * @example
 *   logger.info('Quote request created', { quote_number: 'DPG-001', phone: '0981...' })
 *   logger.error('DB query failed', { route: '/api/quote-requests', error: String(err) })
 */
export const logger = {
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
}

/**
 * Performance timer — works in both dev and production.
 * Production: logs duration_ms as JSON. Dev: logs readable text.
 *
 * Replaces perf-logger.ts logPerf() which only worked in development.
 *
 * @example
 *   const end = startTimer('DB: getProducts')
 *   const products = await prisma.products.findMany(...)
 *   end() // logs: { level: 'info', message: 'DB: getProducts', duration_ms: 42 }
 */
export function startTimer(label: string, meta?: Record<string, unknown>): () => void {
    const start = Date.now()
    return () => {
        const duration_ms = Date.now() - start
        log('info', label, { duration_ms, ...meta })
    }
}

// Keep backward compat shim — logPerf callers won't break
// TODO: migrate all logPerf() calls to startTimer() when convenient
export function logPerf(label: string): () => void {
    return startTimer(label)
}
