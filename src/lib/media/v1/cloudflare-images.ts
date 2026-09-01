import 'server-only'

import {
    MAX_MEDIA_BYTES,
    MAX_IMAGE_PIXELS,
    MediaContractError,
    PRODUCT_V1_PROFILE,
    imageVariantTargets,
    publicImageObjectKey,
    validateImageSource,
} from './contract'
import type { ProcessedMediaObject } from './processor'

/**
 * The binding is injected by the upload-time Worker/server seam. It does not
 * carry a credential and has no storage or delivery responsibility.
 */
export type CloudflareImagesBinding = {
    info(input: ReadableStream<Uint8Array>): Promise<{ width?: number; height?: number; format?: string }>
    input(input: ReadableStream<Uint8Array>): {
        transform(options: { width: number; fit: 'scale-down' }): {
            output(options: { format: 'image/webp'; quality: number }): Promise<{
                response(): Response | Promise<Response>
            }>
        }
    }
}

function imageStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
    const stream = new Response(bytes as unknown as BodyInit).body
    if (!stream) throw new MediaContractError('MEDIA_STREAM_UNAVAILABLE')
    return stream
}

async function responseBytes(response: Response): Promise<Buffer> {
    const contentLength = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES) {
        throw new MediaContractError('MEDIA_TRANSFORM_BYTES_OUT_OF_BOUNDS')
    }
    if (!response.body) {
        const bytes = Buffer.from(await response.arrayBuffer())
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
            throw new MediaContractError('MEDIA_TRANSFORM_BYTES_OUT_OF_BOUNDS')
        }
        return bytes
    }
    const reader = response.body.getReader()
    const chunks: Buffer[] = []
    let total = 0
    try {
        while (true) {
            const next = await reader.read()
            if (next.done) break
            const chunk = Buffer.from(next.value)
            total += chunk.byteLength
            if (total > MAX_MEDIA_BYTES) {
                throw new MediaContractError('MEDIA_TRANSFORM_BYTES_OUT_OF_BOUNDS')
            }
            chunks.push(chunk)
        }
    } finally {
        await reader.cancel().catch(() => undefined)
    }
    if (total === 0) throw new MediaContractError('MEDIA_TRANSFORM_BYTES_OUT_OF_BOUNDS')
    return Buffer.concat(chunks, total)
}

export async function transformProductV1WithCloudflareImages(
    binding: CloudflareImagesBinding,
    input: Uint8Array,
    declaredMime: string,
): Promise<ProcessedMediaObject[]> {
    const source = await validateImageSource(input, declaredMime)
    let providerInfo: { width?: number; height?: number; format?: string }
    try {
        providerInfo = await binding.info(imageStream(source.bytes))
    } catch {
        throw new MediaContractError('CLOUDFLARE_IMAGES_INFO_FAILED')
    }
    if (
        providerInfo.width !== source.widthPx
        || providerInfo.height !== source.heightPx
        || !providerInfo.format
        || !['jpeg', 'png', 'webp'].includes(providerInfo.format.toLowerCase())
        || source.widthPx * source.heightPx > MAX_IMAGE_PIXELS
    ) {
        throw new MediaContractError('CLOUDFLARE_IMAGES_INFO_INVALID')
    }

    const variants: ProcessedMediaObject[] = []
    for (const targetWidthPx of imageVariantTargets(source.widthPx)) {
        let response: Response
        try {
            const transformed = await binding
                .input(imageStream(source.bytes))
                .transform({ width: targetWidthPx, fit: 'scale-down' })
                .output({
                    format: 'image/webp',
                    quality: PRODUCT_V1_PROFILE.quality,
                })
            response = await transformed.response()
        } catch {
            throw new MediaContractError('CLOUDFLARE_IMAGES_TRANSFORM_FAILED')
        }
        if (!response.ok) {
            if (response.body) await response.body.cancel().catch(() => undefined)
            throw new MediaContractError('CLOUDFLARE_IMAGES_TRANSFORM_FAILED')
        }
        const bytes = await responseBytes(response)
        const validated = await validateImageSource(bytes, 'image/webp')
        if (
            validated.widthPx > source.widthPx
            || validated.heightPx > source.heightPx
            || validated.widthPx > targetWidthPx
        ) {
            throw new MediaContractError('CLOUDFLARE_IMAGES_UPSCALE_REJECTED')
        }
        variants.push({
            key: publicImageObjectKey(source.sha256, targetWidthPx, validated.sha256),
            bytes,
            sha256: validated.sha256,
            byteSize: bytes.byteLength,
            mimeType: 'image/webp',
            widthPx: validated.widthPx,
            heightPx: validated.heightPx,
            targetWidthPx,
        })
    }
    return variants
}
