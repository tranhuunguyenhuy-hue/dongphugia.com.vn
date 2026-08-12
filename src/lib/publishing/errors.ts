export type PublishingErrorDetail = {
    field?: string
    code: string
    message?: string
}

export class PublishingApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details?: PublishingErrorDetail[],
        public readonly retryAfterSeconds?: number,
    ) {
        super(message)
        this.name = 'PublishingApiError'
    }
}

export function isPublishingApiError(
    error: unknown,
): error is PublishingApiError {
    return error instanceof PublishingApiError
}
