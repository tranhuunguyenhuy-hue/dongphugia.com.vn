const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const MAX_SOURCE_PIXELS = 40_000_000
const MAX_BUNNY_ATTEMPTS = 2
const BUNNY_TIMEOUT_MS = 10_000
const AUTH_SCHEME = 'Bearer '

const APPROVED_PREVIEW_BUNNY_STORAGE_HOSTNAMES = new Set([
    'sg.storage.bunnycdn.com',
])
const APPROVED_PUBLISHING_CDN_HOSTNAMES = new Set([
    'media.dongphugia.vn',
])

export type ImageTransformOptions = {
    width: number
    height?: number
    fit: 'cover' | 'scale-down'
}

export type ImageOutputOptions = {
    format: 'image/webp'
    quality?: number
    anim?: boolean
}

export type ImageInfo = {
    format: string
    fileSize: number
    width: number
    height: number
}

export type ImageOutput = {
    response(options?: { headers?: HeadersInit }): Response
}

export type ImageTransformer = {
    transform(options: ImageTransformOptions): ImageTransformer
    output(options: ImageOutputOptions): Promise<ImageOutput>
}

export type ImageBinding = {
    info(input: ReadableStream<Uint8Array>): Promise<ImageInfo | { format: string }>
    input(input: ReadableStream<Uint8Array>): ImageTransformer
}

export type Leo544WorkerEnv = {
    IMAGES?: ImageBinding
    MEDIA_TRANSFORM_AUTH_TOKEN?: string
    PUBLISHING_BUNNY_STORAGE_ENVIRONMENT?: string
    PUBLISHING_BUNNY_STORAGE_ZONE_NAME?: string
    PUBLISHING_BUNNY_STORAGE_API_KEY?: string
    PUBLISHING_BUNNY_STORAGE_HOSTNAME?: string
    PUBLISHING_BUNNY_CDN_HOSTNAME?: string
}

type MediaVariant = {
    id: string
    purpose: 'thumbnail' | 'cover' | 'inline'
    width: number
    height?: number
    fit: 'cover' | 'scale-down'
    quality: number
}

export const LEO544_MEDIA_VARIANTS: readonly MediaVariant[] = [
    {
        id: 'thumbnail.w640',
        purpose: 'thumbnail',
        width: 640,
        height: 360,
        fit: 'cover',
        quality: 80,
    },
    {
        id: 'thumbnail.w960',
        purpose: 'thumbnail',
        width: 960,
        height: 540,
        fit: 'cover',
        quality: 80,
    },
    {
        id: 'cover.w720',
        purpose: 'cover',
        width: 720,
        height: 309,
        fit: 'cover',
        quality: 82,
    },
    {
        id: 'cover.w1280',
        purpose: 'cover',
        width: 1280,
        height: 549,
        fit: 'cover',
        quality: 82,
    },
    {
        id: 'cover.w1600',
        purpose: 'cover',
        width: 1600,
        height: 686,
        fit: 'cover',
        quality: 82,
    },
    {
        id: 'inline.w640',
        purpose: 'inline',
        width: 640,
        fit: 'scale-down',
        quality: 80,
    },
    {
        id: 'inline.w960',
        purpose: 'inline',
        width: 960,
        fit: 'scale-down',
        quality: 80,
    },
]

const ALLOWED_SOURCE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
])

class WorkerError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
    }
}

function json(
    body: Record<string, unknown>,
    status: number,
    headers: Record<string, string> = {},
) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
            ...headers,
        },
    })
}

function requiredEnv(env: Leo544WorkerEnv, name: keyof Leo544WorkerEnv) {
    const value = env[name]
    if (typeof value !== 'string' || !value.trim()) {
        throw new WorkerError(
            503,
            'MEDIA_TRANSFORM_NOT_CONFIGURED',
            'Media transform delivery is not configured',
        )
    }
    return value.trim()
}

function safeSegment(value: string, field: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value)) {
        throw new WorkerError(400, 'MEDIA_PATH_INVALID', `${field} is invalid`)
    }
    return value
}

function exactHostname(value: string, field: string, allowlist: Set<string>) {
    const hostname = value.toLowerCase()
    if (
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname)
        || !allowlist.has(hostname)
    ) {
        throw new WorkerError(503, 'MEDIA_STORAGE_NOT_CONFIGURED', `${field} is invalid`)
    }
    return hostname
}

function getVariant(value: string) {
    const variant = LEO544_MEDIA_VARIANTS.find((candidate) => candidate.id === value)
    if (!variant) {
        throw new WorkerError(400, 'MEDIA_VARIANT_INVALID', 'Media variant is invalid')
    }
    return variant
}

function parsePath(request: Request) {
    const parts = new URL(request.url).pathname.split('/').filter(Boolean)
    if (parts.length !== 5 || parts[0] !== 'v1' || parts[1] !== 'media-transform') {
        throw new WorkerError(404, 'MEDIA_ROUTE_NOT_FOUND', 'Media transform route not found')
    }

    let identityId: string
    let assetId: string
    let variantId: string
    try {
        identityId = decodeURIComponent(parts[2] ?? '')
        assetId = decodeURIComponent(parts[3] ?? '')
        variantId = decodeURIComponent(parts[4] ?? '')
    } catch {
        throw new WorkerError(400, 'MEDIA_PATH_INVALID', 'Media path is invalid')
    }

    return {
        identityId: safeSegment(identityId, 'identityId'),
        assetId: safeSegment(assetId, 'assetId'),
        variant: getVariant(variantId),
    }
}

function boundedStream(body: ReadableStream<Uint8Array>) {
    let bytes = 0
    return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
            bytes += chunk.byteLength
            if (bytes > MAX_SOURCE_BYTES) {
                controller.error(new WorkerError(
                    413,
                    'MEDIA_SOURCE_TOO_LARGE',
                    'Media source file exceeds 5 MiB',
                ))
                return
            }
            controller.enqueue(chunk)
        },
    }))
}

function hasExpectedSignature(contentType: string, prefix: number[]) {
    if (contentType === 'image/jpeg') {
        return prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff
    }
    if (contentType === 'image/png') {
        return prefix.slice(0, 8).join(',') === [
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ].join(',')
    }
    return String.fromCharCode(...prefix.slice(0, 12))
        .startsWith('RIFF')
        && String.fromCharCode(...prefix.slice(8, 12)) === 'WEBP'
}

function validatedSourceStream(
    body: ReadableStream<Uint8Array>,
    contentType: string,
) {
    const prefix: number[] = []
    let validated = false
    return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
            if (!validated) {
                prefix.push(...chunk.slice(0, 12 - prefix.length))
                if (prefix.length >= 12 || contentType !== 'image/webp' && prefix.length >= 8) {
                    validated = true
                    if (!hasExpectedSignature(contentType, prefix)) {
                        controller.error(new WorkerError(
                            422,
                            'MEDIA_MIME_MISMATCH',
                            'Media MIME type does not match the source signature',
                        ))
                        return
                    }
                }
            }
            controller.enqueue(chunk)
        },
        flush(controller) {
            if (!validated || !hasExpectedSignature(contentType, prefix)) {
                controller.error(new WorkerError(
                    422,
                    'MEDIA_MIME_MISMATCH',
                    'Media MIME type does not match the source signature',
                ))
            }
        },
    }))
}

async function constantTimeEqual(left: string, right: string) {
    const encoder = new TextEncoder()
    const [leftDigest, rightDigest] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(left)),
        crypto.subtle.digest('SHA-256', encoder.encode(right)),
    ])
    const leftBytes = new Uint8Array(leftDigest)
    const rightBytes = new Uint8Array(rightDigest)
    const timingSafeSubtle = crypto.subtle as SubtleCrypto & {
        timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean
    }
    if (typeof timingSafeSubtle.timingSafeEqual === 'function') {
        return timingSafeSubtle.timingSafeEqual(leftBytes, rightBytes)
    }

    let difference = 0
    for (let index = 0; index < leftBytes.length; index += 1) {
        difference |= leftBytes[index] ^ rightBytes[index]
    }
    return difference === 0
}

async function authorize(request: Request, env: Leo544WorkerEnv) {
    const configured = requiredEnv(env, 'MEDIA_TRANSFORM_AUTH_TOKEN')
    const supplied = request.headers.get('Authorization')
    if (
        !supplied
        || !await constantTimeEqual(supplied, `${AUTH_SCHEME}${configured}`)
    ) {
        throw new WorkerError(401, 'MEDIA_UNAUTHORIZED', 'Media transform is unauthorized')
    }
}

function bunnyConfig(env: Leo544WorkerEnv) {
    const environment = requiredEnv(env, 'PUBLISHING_BUNNY_STORAGE_ENVIRONMENT')
    if (environment !== 'preview') {
        throw new WorkerError(
            403,
            'MEDIA_ENVIRONMENT_NOT_ALLOWED',
            'This source-only transform proof is limited to Preview',
        )
    }

    const zone = safeSegment(
        requiredEnv(env, 'PUBLISHING_BUNNY_STORAGE_ZONE_NAME'),
        'storage zone',
    )
    const storageHost = exactHostname(
        requiredEnv(env, 'PUBLISHING_BUNNY_STORAGE_HOSTNAME'),
        'storage host',
        APPROVED_PREVIEW_BUNNY_STORAGE_HOSTNAMES,
    )
    const cdnHost = exactHostname(
        requiredEnv(env, 'PUBLISHING_BUNNY_CDN_HOSTNAME'),
        'CDN host',
        APPROVED_PUBLISHING_CDN_HOSTNAMES,
    )
    return {
        zone,
        storageHost,
        cdnHost,
        apiKey: requiredEnv(env, 'PUBLISHING_BUNNY_STORAGE_API_KEY'),
    }
}

function objectPath(
    identityId: string,
    assetId: string,
    variant: MediaVariant,
) {
    return `publishing/${identityId}/${assetId}/${variant.id}.webp`
}

async function sha256(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    try {
        while (true) {
            const next = await reader.read()
            if (next.done) break
            chunks.push(next.value)
            length += next.value.byteLength
        }
    } finally {
        reader.releaseLock()
    }

    const source = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
        source.set(chunk, offset)
        offset += chunk.byteLength
    }
    const digest = await crypto.subtle.digest('SHA-256', source)
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

function requiredSha256(request: Request) {
    const value = request.headers.get('X-Source-SHA256')?.trim().toLowerCase()
    if (!value || !/^[a-f0-9]{64}$/.test(value)) {
        throw new WorkerError(
            400,
            'MEDIA_SOURCE_DIGEST_REQUIRED',
            'A source SHA-256 digest is required',
        )
    }
    return value
}

function validateSourceInfo(info: ImageInfo | { format: string }, contentType: string) {
    const rawFormat = typeof info?.format === 'string' ? info.format.toLowerCase().trim() : ''
    const normalizedFormat = rawFormat === 'jpg' || rawFormat === 'jpeg'
        ? 'image/jpeg'
        : rawFormat === 'png'
            ? 'image/png'
            : rawFormat === 'webp'
                ? 'image/webp'
                : rawFormat
    if (
        !info
        || normalizedFormat !== contentType
        || !('width' in info)
        || !('height' in info)
        || !Number.isSafeInteger(info.width)
        || !Number.isSafeInteger(info.height)
        || info.width < 1
        || info.height < 1
    ) {
        throw new WorkerError(
            422,
            'MEDIA_SOURCE_DIMENSIONS_INVALID',
            'Cloudflare Images returned invalid source dimensions',
        )
    }

    if (info.width > Math.floor(MAX_SOURCE_PIXELS / info.height)) {
        throw new WorkerError(
            422,
            'MEDIA_SOURCE_DIMENSIONS_TOO_LARGE',
            'Media source dimensions exceed 40 megapixels',
        )
    }
    return { width: info.width, height: info.height }
}

function outputDimensions(
    source: { width: number; height: number },
    variant: MediaVariant,
) {
    if (variant.height) {
        return { width: variant.width, height: variant.height }
    }
    const width = Math.min(source.width, variant.width)
    return {
        width,
        height: Math.max(1, Math.round(source.height * width / source.width)),
    }
}

async function deliverToBunny(
    config: ReturnType<typeof bunnyConfig>,
    path: string,
    body: ReadableStream<Uint8Array>,
) {
    let remaining = body
    for (let attempt = 1; attempt <= MAX_BUNNY_ATTEMPTS; attempt += 1) {
        const [attemptBody, retryBody] = remaining.tee()
        try {
            const response = await fetch(
                `https://${config.storageHost}/${config.zone}/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        AccessKey: config.apiKey,
                        'Cache-Control': 'public, max-age=31536000, immutable',
                        'Content-Type': 'image/webp',
                    },
                    body: attemptBody,
                    signal: AbortSignal.timeout(BUNNY_TIMEOUT_MS),
                },
            )
            await response.body?.cancel()
            if (response.ok) {
                await retryBody.cancel()
                return
            }
            if (response.status < 500 || attempt === MAX_BUNNY_ATTEMPTS) {
                await retryBody.cancel()
                break
            }
        } catch {
            if (attempt === MAX_BUNNY_ATTEMPTS) {
                await retryBody.cancel()
                break
            }
        }
        remaining = retryBody
    }
    throw new WorkerError(502, 'MEDIA_STORAGE_FAILED', 'Managed Media storage failed')
}

export default {
    async fetch(request: Request, env: Leo544WorkerEnv): Promise<Response> {
        try {
            if (request.method !== 'POST') {
                return json(
                    { error: 'MEDIA_METHOD_NOT_ALLOWED' },
                    405,
                    { Allow: 'POST' },
                )
            }

            await authorize(request, env)
            const target = parsePath(request)
            const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
            if (!contentType || !ALLOWED_SOURCE_TYPES.has(contentType)) {
                throw new WorkerError(
                    415,
                    'MEDIA_TYPE_UNSUPPORTED',
                    'Managed Media supports JPEG, PNG, and WebP source files',
                )
            }
            const declaredLength = request.headers.get('Content-Length')
            if (declaredLength) {
                const length = Number(declaredLength)
                if (!Number.isSafeInteger(length) || length < 0) {
                    throw new WorkerError(
                        400,
                        'MEDIA_CONTENT_LENGTH_INVALID',
                        'Media content length is invalid',
                    )
                }
                if (length > MAX_SOURCE_BYTES) {
                    throw new WorkerError(
                        413,
                        'MEDIA_SOURCE_TOO_LARGE',
                        'Media source file exceeds 5 MiB',
                    )
                }
            }
            if (!request.body) {
                throw new WorkerError(400, 'MEDIA_BODY_REQUIRED', 'Media source body is required')
            }
            if (!env.IMAGES) {
                throw new WorkerError(
                    503,
                    'MEDIA_TRANSFORM_NOT_CONFIGURED',
                    'Cloudflare Images binding is not configured',
                )
            }
            const config = bunnyConfig(env)
            const expectedSourceHash = requiredSha256(request)

            const [imagesInput, infoAndDigestInput] = validatedSourceStream(
                boundedStream(request.body),
                contentType,
            ).tee()
            const [infoInput, digestInput] = infoAndDigestInput.tee()

            const transformedPromise = env.IMAGES
                .input(imagesInput)
                .transform({
                    width: target.variant.width,
                    ...(target.variant.height ? { height: target.variant.height } : {}),
                    fit: target.variant.fit,
                })
                .output({ format: 'image/webp', quality: target.variant.quality })
            const sourceInfoPromise = env.IMAGES.info(infoInput)
                .then((info) => validateSourceInfo(info, contentType))
                .catch((error) => {
                    if (error instanceof WorkerError) throw error
                    throw new WorkerError(
                        422,
                        'MEDIA_SOURCE_INVALID',
                        'Cloudflare Images could not parse the source image',
                    )
                })
            const [transformed, sourceInfo, actualSourceHash] = await Promise.all([
                transformedPromise,
                sourceInfoPromise,
                sha256(digestInput),
            ])
            if (actualSourceHash !== expectedSourceHash) {
                throw new WorkerError(
                    422,
                    'MEDIA_SOURCE_DIGEST_MISMATCH',
                    'Media source digest does not match the attestation',
                )
            }
            const imageResponse = transformed.response()
            const outputContentType = imageResponse.headers
                .get('Content-Type')
                ?.split(';')[0]
                ?.trim()
                .toLowerCase()
            if (!imageResponse.ok || !imageResponse.body || outputContentType !== 'image/webp') {
                await imageResponse.body?.cancel()
                throw new WorkerError(
                    422,
                    'MEDIA_TRANSFORM_FAILED',
                    'Cloudflare Images could not transform the source',
                )
            }

            const storagePath = objectPath(
                target.identityId,
                target.assetId,
                target.variant,
            )
            await deliverToBunny(config, storagePath, imageResponse.body)
            const dimensions = outputDimensions(sourceInfo, target.variant)

            return json({
                delivery: 'bunny',
                format: 'webp',
                height: dimensions.height,
                path: storagePath,
                purpose: target.variant.purpose,
                url: `https://${config.cdnHost}/${storagePath}`,
                variant: target.variant.id,
                width: dimensions.width,
            }, 201)
        } catch (error) {
            if (error instanceof WorkerError) {
                console.error(JSON.stringify({
                    code: error.code,
                    event: 'leo544_media_transform_failed',
                    status: error.status,
                }))
                return json({ error: error.code }, error.status)
            }
            console.error(JSON.stringify({
                code: 'MEDIA_TRANSFORM_FAILED',
                event: 'leo544_media_transform_failed',
                status: 502,
            }))
            return json({ error: 'MEDIA_TRANSFORM_FAILED' }, 502)
        }
    },
}
