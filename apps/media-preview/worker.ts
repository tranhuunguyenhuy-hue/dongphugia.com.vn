import { PRODUCT_V1_PROFILE } from '../../src/lib/media/v1/profile'

const MAX_MEDIA_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const PROFILE_VERSION = PRODUCT_V1_PROFILE.version

type ImageInfo = {
    width?: number
    height?: number
    format?: string
}

type ImageTransform = {
    transform(options: {
        width: number
        fit: 'scale-down'
    }): {
        output(options: {
            format: 'image/webp'
            quality: number
        }): Promise<{
            response(): Promise<Response> | Response
        }>
    }
}

type ImageInput = ReadableStream<Uint8Array>

type ImagesBinding = {
    info(input: ImageInput): Promise<ImageInfo>
    input(input: ImageInput): ImageTransform
}

type BoundedBody = {
    headers: Headers
    body: ReadableStream<Uint8Array> | null
    arrayBuffer(): Promise<ArrayBuffer>
}

export type MediaPreviewEnv = {
    IMAGES: ImagesBinding
    MEDIA_TRANSFORM_AUTH_TOKEN: string
    APP_ENV: string
    PREVIEW_NOINDEX?: string
}

function jsonError(status: number, code: string): Response {
    return new Response(JSON.stringify({ error: code }), {
        status,
        headers: {
            'cache-control': 'no-store',
            'content-type': 'application/json; charset=utf-8',
            'x-robots-tag': 'noindex, nofollow',
        },
    })
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
    return prefix.every((value, index) => bytes[index] === value)
}

function hasWebpSignature(bytes: Uint8Array): boolean {
    return hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46])
        && bytes[8] === 0x57
        && bytes[9] === 0x45
        && bytes[10] === 0x42
        && bytes[11] === 0x50
}

function signatureMatches(bytes: Uint8Array, mimeType: string): boolean {
    if (mimeType === 'image/jpeg') return hasPrefix(bytes, [0xff, 0xd8, 0xff])
    if (mimeType === 'image/png') {
        return hasPrefix(bytes, [
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ])
    }
    return mimeType === 'image/webp' && hasWebpSignature(bytes)
}

function normalizedMime(value: string | null): string {
    return value?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function declaredImageFormat(mimeType: string): string {
    return mimeType === 'image/jpeg' ? 'jpeg' : mimeType.slice('image/'.length)
}

function normalizedImageFormat(value: string | undefined): string {
    return value?.toLowerCase().replace(/^image\//, '') ?? ''
}

function readPositiveInteger(value: string | null): number | null {
    if (!value || !/^[1-9][0-9]*$/.test(value)) return null
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
}

function imageStream(bytes: Uint8Array): ImageInput {
    const stream = new Response(bytes as unknown as BodyInit).body
    if (!stream) throw new Error('MEDIA_STREAM_UNAVAILABLE')
    return stream
}

async function readBoundedBytes(response: BoundedBody): Promise<Uint8Array> {
    const contentLength = response.headers.get('content-length')
    if (contentLength !== null) {
        const parsedLength = readPositiveInteger(contentLength)
        if (parsedLength === null || parsedLength > MAX_MEDIA_BYTES) {
            throw new Error('MEDIA_BYTES_OUT_OF_BOUNDS')
        }
    }
    if (!response.body) {
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
            throw new Error('MEDIA_BYTES_OUT_OF_BOUNDS')
        }
        return bytes
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
        while (true) {
            const next = await reader.read()
            if (next.done) break
            const chunk = new Uint8Array(next.value)
            total += chunk.byteLength
            if (total > MAX_MEDIA_BYTES) throw new Error('MEDIA_BYTES_OUT_OF_BOUNDS')
            chunks.push(chunk)
        }
    } finally {
        await reader.cancel().catch(() => undefined)
    }
    if (total === 0) throw new Error('MEDIA_BYTES_OUT_OF_BOUNDS')

    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    return bytes
}

function isAuthorized(request: Request, expectedToken: string): boolean {
    if (!expectedToken) return false
    return request.headers.get('authorization') === `Bearer ${expectedToken}`
}

async function validateSource(
    bytes: Uint8Array,
    mimeType: string,
    binding: ImagesBinding,
): Promise<ImageInfo> {
    if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
        || !signatureMatches(bytes, mimeType)
    ) {
        throw new Error('MEDIA_SIGNATURE_MISMATCH')
    }

    const info = await binding.info(imageStream(bytes))
    if (
        !info.width
        || !info.height
        || info.width <= 0
        || info.height <= 0
        || info.width * info.height > MAX_IMAGE_PIXELS
        || normalizedImageFormat(info.format) !== declaredImageFormat(mimeType)
    ) {
        throw new Error('MEDIA_DECODE_FAILED')
    }
    return info
}

export async function handleMediaPreviewRequest(
    request: Request,
    env: MediaPreviewEnv,
): Promise<Response> {
    if (request.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED')
    if (!isAuthorized(request, env.MEDIA_TRANSFORM_AUTH_TOKEN)) {
        return jsonError(401, 'MEDIA_TRANSFORM_UNAUTHORIZED')
    }
    if (env.APP_ENV !== 'preview') {
        return jsonError(403, 'MEDIA_TRANSFORM_PREVIEW_ONLY')
    }
    if (!env.IMAGES) return jsonError(500, 'MEDIA_TRANSFORM_BINDING_MISSING')

    const profileVersion = request.headers.get('x-dpg-media-profile')
    if (profileVersion !== PROFILE_VERSION) {
        return jsonError(422, 'MEDIA_PROFILE_UNSUPPORTED')
    }
    const targetWidthPx = readPositiveInteger(
        request.headers.get('x-dpg-media-target-width'),
    )
    if (
        targetWidthPx === null
        || !PRODUCT_V1_PROFILE.widths.includes(targetWidthPx)
    ) {
        return jsonError(422, 'MEDIA_PROFILE_WIDTH_UNSUPPORTED')
    }

    let bytes: Uint8Array
    try {
        const declaredContentLength = request.headers.get('content-length')
        if (declaredContentLength !== null) {
            const parsedLength = readPositiveInteger(declaredContentLength)
            if (parsedLength === null || parsedLength > MAX_MEDIA_BYTES) {
                return jsonError(413, 'MEDIA_BYTES_OUT_OF_BOUNDS')
            }
        }
        bytes = await readBoundedBytes(request)
    } catch (error) {
        return jsonError(
            413,
            error instanceof Error && error.message === 'MEDIA_BYTES_OUT_OF_BOUNDS'
                ? error.message
                : 'MEDIA_BYTES_OUT_OF_BOUNDS',
        )
    }

    const mimeType = normalizedMime(request.headers.get('content-type'))
    let sourceInfo: ImageInfo
    try {
        sourceInfo = await validateSource(bytes, mimeType, env.IMAGES)
    } catch (error) {
        const code = error instanceof Error ? error.message : 'MEDIA_DECODE_FAILED'
        return jsonError(
            code === 'MEDIA_SIGNATURE_MISMATCH' ? 415 : 422,
            code,
        )
    }
    if ((sourceInfo.width ?? 0) < targetWidthPx) {
        return jsonError(422, 'MEDIA_UPSCALE_REJECTED')
    }

    let transformed: Response
    try {
        const transformedHandle = await env.IMAGES
            .input(imageStream(bytes))
            .transform({ width: targetWidthPx, fit: 'scale-down' })
            .output({
                format: 'image/webp',
                quality: PRODUCT_V1_PROFILE.quality,
            })
        transformed = await transformedHandle.response()
    } catch (error) {
        return jsonError(
            502,
            'CLOUDFLARE_IMAGES_TRANSFORM_FAILED',
        )
    }
    if (!transformed.ok) {
        if (transformed.body) await transformed.body.cancel().catch(() => undefined)
        return jsonError(
            502,
            `CLOUDFLARE_IMAGES_TRANSFORM_FAILED_${transformed.status}`,
        )
    }

    let outputBytes: Uint8Array
    try {
        outputBytes = await readBoundedBytes(transformed)
    } catch {
        return jsonError(502, 'MEDIA_TRANSFORM_BYTES_OUT_OF_BOUNDS')
    }
    let outputInfo: ImageInfo
    try {
        outputInfo = await env.IMAGES.info(imageStream(outputBytes))
    } catch {
        return jsonError(502, 'MEDIA_TRANSFORM_OUTPUT_INVALID')
    }
    if (
        normalizedImageFormat(outputInfo.format) !== 'webp'
        || !outputInfo.width
        || !outputInfo.height
        || outputInfo.width <= 0
        || outputInfo.height <= 0
        || outputInfo.width > targetWidthPx
        || outputInfo.width > (sourceInfo.width ?? 0)
        || outputInfo.height > (sourceInfo.height ?? 0)
        || outputInfo.width * outputInfo.height > MAX_IMAGE_PIXELS
    ) {
        return jsonError(502, 'MEDIA_TRANSFORM_OUTPUT_INVALID')
    }

    return new Response(outputBytes as unknown as BodyInit, {
        status: 200,
        headers: {
            'cache-control': 'no-store',
            'content-length': String(outputBytes.byteLength),
            'content-type': 'image/webp',
            'x-dpg-media-profile': PROFILE_VERSION,
            'x-dpg-media-target-width': String(targetWidthPx),
            'x-robots-tag': 'noindex, nofollow',
        },
    })
}

export default {
    fetch(request: Request, env: MediaPreviewEnv): Promise<Response> {
        return handleMediaPreviewRequest(request, env)
    },
}
