import { NextResponse } from 'next/server'
import { ZodError, ZodIssue } from 'zod'

// ================================================================
// LEO-390: Centralized API Error Handler
// Unified error response format: { success, error, code?, details? }
// ================================================================

/**
 * Typed API error with HTTP status code and optional error code.
 * Throw this inside route handlers for expected errors.
 *
 * @example
 *   throw new ApiError(404, 'Sản phẩm không tồn tại', 'PRODUCT_NOT_FOUND')
 */
export class ApiError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly code?: string
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

// Standard API response shape
export interface ApiSuccessResponse<T = unknown> {
    success: true
    data?: T
    [key: string]: unknown
}

export interface ApiErrorResponse {
    success: false
    error: string
    code?: string
    details?: unknown
}

/**
 * Wrap a route handler in try/catch with centralized error handling.
 * Catches ApiError, ZodError, and unknown errors uniformly.
 *
 * @example
 *   export const GET = withErrorHandler(async (req) => {
 *     const data = await fetchSomething()
 *     return NextResponse.json({ success: true, data })
 *   })
 */
export function withErrorHandler(
    handler: (...args: unknown[]) => Promise<NextResponse>
): (...args: unknown[]) => Promise<NextResponse> {
    return async (...args: unknown[]) => {
        try {
            return await handler(...args)
        } catch (error) {
            return handleApiError(error)
        }
    }
}

/**
 * Convert any thrown error into a typed NextResponse.
 * Use this in existing catch blocks as a one-liner.
 *
 * @example
 *   } catch (error) {
 *     return handleApiError(error)
 *   }
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
    // Known API errors (expected — e.g. 404, 401, 400)
    if (error instanceof ApiError) {
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                ...(error.code ? { code: error.code } : {}),
            },
            { status: error.statusCode }
        )
    }

    // Zod validation errors (400)
    if (error instanceof ZodError) {
        return NextResponse.json(
            {
                success: false,
                error: 'Dữ liệu không hợp lệ',
                code: 'VALIDATION_ERROR',
                details: error.issues.map((issue: ZodIssue) => ({
                    field: issue.path.map(String).join('.'),
                    message: issue.message,
                })),
            },
            { status: 400 }
        )
    }


    // Unknown/unexpected errors — log but don't expose internals
    console.error('[API Error]', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
        {
            success: false,
            error: 'Lỗi server. Vui lòng thử lại sau.',
            code: 'INTERNAL_SERVER_ERROR',
        },
        { status: 500 }
    )
}

// Common pre-built ApiErrors for convenience
export const ApiErrors = {
    notFound: (resource = 'Tài nguyên') =>
        new ApiError(404, `${resource} không tồn tại`, 'NOT_FOUND'),
    unauthorized: () =>
        new ApiError(401, 'Chưa đăng nhập', 'UNAUTHORIZED'),
    forbidden: () =>
        new ApiError(403, 'Không có quyền truy cập', 'FORBIDDEN'),
    badRequest: (msg: string) =>
        new ApiError(400, msg, 'BAD_REQUEST'),
    rateLimited: () =>
        new ApiError(429, 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', 'RATE_LIMITED'),
} as const
