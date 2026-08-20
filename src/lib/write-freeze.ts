import { isProductionRuntime } from './runtime-role'

/**
 * Server-side write-freeze guard for database cutover windows.
 *
 * Default is OFF. The flag is intentionally separate from MAINTENANCE_MODE
 * because maintenance proxy rules bypass /api and /admin.
 */
export const WRITE_FREEZE_ENV = 'WRITE_FREEZE_MODE'
export const WRITE_FREEZE_ERROR_CODE = 'WRITE_FREEZE_ACTIVE'

const WRITE_FREEZE_MESSAGE =
    'Hệ thống đang tạm dừng ghi dữ liệu để bảo trì. Vui lòng thử lại sau.'

export class WriteFreezeError extends Error {
    readonly code = WRITE_FREEZE_ERROR_CODE
    readonly statusCode = 503

    constructor(readonly operation: string) {
        super(WRITE_FREEZE_MESSAGE)
        this.name = 'WriteFreezeError'
    }
}

export function isWriteFreezeEnabled() {
    const configured = process.env[WRITE_FREEZE_ENV]
    if (configured === 'true') return true
    if (configured === 'false') return !isProductionRuntime()

    // Treat every production server runtime as frozen unless the explicit
    // Production role above thaws it. This also protects a legacy Staging
    // deployment that still overrides the candidate's build target.
    return process.env.NODE_ENV === 'production'
}

export function requireWritesAllowed(operation: string) {
    if (isWriteFreezeEnabled()) {
        throw new WriteFreezeError(operation)
    }
}

export function isWriteFreezeError(error: unknown): error is WriteFreezeError {
    return (
        error instanceof WriteFreezeError ||
        (error instanceof Error &&
            error.name === 'WriteFreezeError' &&
            'code' in error &&
            error.code === WRITE_FREEZE_ERROR_CODE)
    )
}

export function getWriteFreezeMessage() {
    return WRITE_FREEZE_MESSAGE
}

export function toWriteFreezeActionResult(error: unknown) {
    if (!isWriteFreezeError(error)) return null

    return {
        success: false as const,
        errors: undefined,
        error: WRITE_FREEZE_MESSAGE,
        message: WRITE_FREEZE_MESSAGE,
        code: WRITE_FREEZE_ERROR_CODE,
        statusCode: 503 as const,
    }
}
