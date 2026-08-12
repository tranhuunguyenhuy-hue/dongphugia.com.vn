import { isPublishingMediaPurpose, PUBLISHING_MEDIA_MAX_BYTES } from '@/lib/publishing/media'
import { uploadPublishingMedia } from '@/lib/publishing/media-upload'
import { PublishingApiError } from '@/lib/publishing/errors'
import { publishingJson, requireIdempotencyKey } from '@/lib/publishing/http'
import { withAuthenticatedPublishingRoute } from '@/lib/publishing/route'

export const dynamic = 'force-dynamic'

const MAX_MULTIPART_BYTES = PUBLISHING_MEDIA_MAX_BYTES + 128 * 1024

export async function POST(request: Request) {
    return withAuthenticatedPublishingRoute(
        request,
        { requiredCapabilities: ['media:write'], bucket: 'media' },
        async ({ auth, config, requestId }) => {
            const contentType = request.headers.get('content-type') ?? ''
            if (!contentType.startsWith('multipart/form-data;')) {
                throw new PublishingApiError(
                    415,
                    'CONTENT_TYPE_UNSUPPORTED',
                    'Content-Type must be multipart/form-data',
                )
            }
            const contentLengthHeader = request.headers.get('content-length')
            const contentLength = Number(contentLengthHeader)
            if (
                !contentLengthHeader
                || !Number.isSafeInteger(contentLength)
                || contentLength < 1
                || contentLength > MAX_MULTIPART_BYTES
            ) {
                throw new PublishingApiError(
                    413,
                    'REQUEST_TOO_LARGE',
                    'Managed Media requires a bounded Content-Length',
                )
            }
            let formData: FormData
            try {
                formData = await request.formData()
            } catch {
                throw new PublishingApiError(
                    422,
                    'MULTIPART_INVALID',
                    'Managed Media request must contain valid multipart form data',
                )
            }
            const file = formData.get('file')
            const purposeValue = formData.get('purpose')
            const purpose = typeof purposeValue === 'string' ? purposeValue : null
            if (!(file instanceof File) || !isPublishingMediaPurpose(purpose)) {
                throw new PublishingApiError(
                    422,
                    'MEDIA_INPUT_INVALID',
                    'Managed Media requires a file and valid purpose',
                )
            }
            if (file.size > PUBLISHING_MEDIA_MAX_BYTES) {
                throw new PublishingApiError(
                    422,
                    'MEDIA_SOURCE_TOO_LARGE',
                    'Managed Media source file exceeds 5 MiB',
                )
            }
            const source = Buffer.from(await file.arrayBuffer())
            const result = await uploadPublishingMedia({
                auth,
                environment: config.environment,
                idempotencyKey: requireIdempotencyKey(request.headers),
                purpose,
                declaredMime: file.type,
                source,
                requestId,
            })
            return publishingJson(result.body, { status: result.status })
        },
    )
}
