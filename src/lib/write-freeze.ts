/**
 * Server-side write-freeze guard for database cutover windows.
 *
 * Default is OFF. The flag is intentionally separate from MAINTENANCE_MODE
 * because maintenance proxy rules bypass /api and /admin.
 */
export const WRITE_FREEZE_ENV = 'WRITE_FREEZE_MODE'
export const STAGING_SAFETY_MODE_ENV = 'STAGING_SAFETY_MODE'
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
    return process.env[WRITE_FREEZE_ENV] === 'true'
        || process.env[STAGING_SAFETY_MODE_ENV] === 'true'
}

export function requireWritesAllowed(operation: string) {
    if (isWriteFreezeEnabled()) {
        throw new WriteFreezeError(operation)
    }
}

export function isWriteFreezeError(error: unknown): error is WriteFreezeError {
    return error instanceof WriteFreezeError
        || (
            error instanceof Error
            && error.name === 'WriteFreezeError'
            && 'code' in error
            && error.code === WRITE_FREEZE_ERROR_CODE
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
