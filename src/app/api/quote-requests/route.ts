import { NextRequest, NextResponse } from 'next/server'
import { submitQuoteRequest } from '@/lib/actions'
import { rateLimiter, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'

export async function GET() {
    return NextResponse.json(
        {
            success: false,
            error: 'Tra cứu báo giá công khai không còn được hỗ trợ.',
            code: 'METHOD_NOT_ALLOWED',
        },
        { status: 405, headers: { Allow: 'POST' } },
    )
}

// POST /api/quote-requests
// Alternative REST endpoint for quote submission (Server Action is primary)
export async function POST(request: NextRequest) {
    // --- LEO-388: Rate Limiting ---
    const ip = getClientIp(request)
    const { maxReqs, windowMs } = RATE_LIMITS.quotePost
    if (!rateLimiter.isAllowed(`quote:post:${ip}`, maxReqs, windowMs)) {
        return NextResponse.json(
            { success: false, error: 'Quá nhiều yêu cầu gửi báo giá. Vui lòng thử lại sau 1 phút.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': String(maxReqs),
                    'X-RateLimit-Remaining': '0',
                    'Retry-After': '60',
                },
            }
        )
    }

    try {
        const body = await request.json()
        const result = await submitQuoteRequest(body)

        if (!result.success) {
            return NextResponse.json(result, { status: 400 })
        }

        logger.info('Quote request submitted', { route: 'POST /api/quote-requests' })
        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        logger.error('Quote submission failed', { route: 'POST /api/quote-requests', error: String(error) })
        return handleApiError(error)
    }
}
