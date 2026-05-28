import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { submitQuoteRequest } from '@/lib/actions'
import { rateLimiter, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'

// GET /api/quote-requests?phone=0981234567
// Public lookup: customer enters phone to see their quote history
export async function GET(request: NextRequest) {
    // --- LEO-388: Rate Limiting ---
    const ip = getClientIp(request)
    const { maxReqs, windowMs } = RATE_LIMITS.quoteGet
    if (!rateLimiter.isAllowed(`get:${ip}`, maxReqs, windowMs)) {
        return NextResponse.json(
            { success: false, error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' },
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

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')?.trim()

    if (!phone || phone.length < 9 || phone.length > 15) {
        return NextResponse.json(
            { success: false, error: 'Số điện thoại không hợp lệ' },
            { status: 400 }
        )
    }

    // Sanitize: only allow digits, spaces, dashes, plus sign
    if (!/^[\d\s\-\+]+$/.test(phone)) {
        return NextResponse.json(
            { success: false, error: 'Số điện thoại chứa ký tự không hợp lệ' },
            { status: 400 }
        )
    }

    try {
        const quotes = await prisma.quote_requests.findMany({
            where: { phone },
            orderBy: { created_at: 'desc' },
            take: 20, // max 20 recent quotes per phone
            select: {
                id: true,
                quote_number: true,
                name: true,
                status: true,
                message: true,
                created_at: true,
                quote_items: {
                    select: {
                        id: true,
                        quantity: true,
                        note: true,
                        products: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                price_display: true,
                                image_main_url: true,
                                categories: { select: { slug: true } },
                                slug: true,
                            },
                        },
                    },
                },
            },
        })

        const remaining = rateLimiter.remaining(`get:${ip}`, maxReqs, windowMs)

        // Never expose phone/email in response for privacy
        return NextResponse.json(
            {
                success: true,
                count: quotes.length,
                quotes: quotes.map(q => ({
                    quote_number: q.quote_number,
                    status: q.status,
                    message: q.message,
                    created_at: q.created_at,
                    items: q.quote_items.map(item => ({
                        quantity: item.quantity,
                        note: item.note,
                        product: {
                            name: item.products.name,
                            sku: item.products.sku,
                            price_display: item.products.price_display,
                            image_url: item.products.image_main_url,
                            url: `/${item.products.categories.slug}/${item.products.slug}`,
                        },
                    })),
                })),
            },
            {
                headers: {
                    'X-RateLimit-Limit': String(maxReqs),
                    'X-RateLimit-Remaining': String(remaining),
                },
            }
        )
    } catch (error) {
        logger.error('Quote lookup failed', { route: 'GET /api/quote-requests', error: String(error) })
        return handleApiError(error)
    }
}

// POST /api/quote-requests
// Alternative REST endpoint for quote submission (Server Action is primary)
export async function POST(request: NextRequest) {
    // --- LEO-388: Rate Limiting ---
    const ip = getClientIp(request)
    const { maxReqs, windowMs } = RATE_LIMITS.quotePost
    if (!rateLimiter.isAllowed(`post:${ip}`, maxReqs, windowMs)) {
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
