import sharp, { type Metadata } from 'sharp'

import { PublishingApiError } from './errors'

export const PUBLISHING_MEDIA_MAX_BYTES = 5 * 1024 * 1024
export const PUBLISHING_MEDIA_MAX_PIXELS = 40_000_000

export const PUBLISHING_MEDIA_PROFILES = {
    thumbnail: {
        widths: [640, 960],
        aspectRatio: 16 / 9,
        quality: 80,
    },
    cover: {
        widths: [720, 1280, 1600],
        aspectRatio: 21 / 9,
        quality: 82,
    },
    inline: {
        widths: [640, 960],
        aspectRatio: null,
        quality: 80,
    },
} as const

export type PublishingMediaPurpose = keyof typeof PUBLISHING_MEDIA_PROFILES

export type PublishingProcessedVariant = {
    targetWidth: number
    width: number
    height: number
    bytes: number
    format: 'webp'
    buffer: Buffer
}

export type PublishingProcessedImage = {
    sourceWidth: number
    sourceHeight: number
    variants: PublishingProcessedVariant[]
}

const MIME_TO_FORMAT = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
} as const

export function isPublishingMediaPurpose(
    value: string | null,
): value is PublishingMediaPurpose {
    return value !== null && Object.hasOwn(PUBLISHING_MEDIA_PROFILES, value)
}

export async function processPublishingImage(
    source: Buffer,
    declaredMime: string,
    purpose: PublishingMediaPurpose,
): Promise<PublishingProcessedImage> {
    const expectedFormat = MIME_TO_FORMAT[
        declaredMime as keyof typeof MIME_TO_FORMAT
    ]
    if (!expectedFormat) {
        throw new PublishingApiError(
            422,
            'MEDIA_TYPE_UNSUPPORTED',
            'Managed Media supports JPEG, PNG, and WebP source files',
            [{ field: 'file', code: 'MEDIA_TYPE_UNSUPPORTED' }],
        )
    }
    if (source.byteLength > PUBLISHING_MEDIA_MAX_BYTES) {
        throw new PublishingApiError(
            422,
            'MEDIA_SOURCE_TOO_LARGE',
            'Managed Media source file exceeds 5 MiB',
            [{ field: 'file', code: 'MEDIA_SOURCE_TOO_LARGE' }],
        )
    }

    let metadata: Metadata
    try {
        metadata = await sharp(source, {
            failOn: 'error',
            limitInputPixels: PUBLISHING_MEDIA_MAX_PIXELS,
        }).metadata()
    } catch {
        throw new PublishingApiError(
            422,
            'MEDIA_SOURCE_INVALID',
            'Managed Media source cannot be decoded safely',
            [{ field: 'file', code: 'MEDIA_SOURCE_INVALID' }],
        )
    }
    if (
        metadata.format !== expectedFormat
        || !metadata.width
        || !metadata.height
    ) {
        throw new PublishingApiError(
            422,
            'MEDIA_MIME_MISMATCH',
            'Managed Media MIME type does not match the decoded file',
            [{ field: 'file', code: 'MEDIA_MIME_MISMATCH' }],
        )
    }

    const profile = PUBLISHING_MEDIA_PROFILES[purpose]
    const variants = await Promise.all(
        profile.widths.map(async (targetWidth) => {
            const resize = profile.aspectRatio
                ? {
                    width: targetWidth,
                    height: Math.round(targetWidth / profile.aspectRatio),
                    fit: 'cover' as const,
                    position: 'attention' as const,
                }
                : {
                    width: targetWidth,
                    fit: 'inside' as const,
                    withoutEnlargement: true,
                }
            const { data, info } = await sharp(source, {
                failOn: 'error',
                limitInputPixels: PUBLISHING_MEDIA_MAX_PIXELS,
            })
                .rotate()
                .resize(resize)
                .webp({
                    quality: profile.quality,
                    effort: 4,
                    smartSubsample: true,
                })
                .toBuffer({ resolveWithObject: true })

            return {
                targetWidth,
                width: info.width,
                height: info.height,
                bytes: info.size,
                format: 'webp' as const,
                buffer: data,
            }
        }),
    )

    return {
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
        variants,
    }
}
