import sharp from 'sharp'
import {
    MEDIA_PROFILES,
    type MediaProfile,
} from '@/lib/media/media-profiles'

const MAX_INPUT_PIXELS = 40_000_000

export type ProcessedMediaVariant = {
    buffer: Buffer
    width: number
    height: number
    bytes: number
}

export type ProcessedMedia = {
    sourceWidth: number
    sourceHeight: number
    variants: ProcessedMediaVariant[]
}

export async function processImage(
    input: Buffer,
    profile: MediaProfile,
): Promise<ProcessedMedia> {
    const source = sharp(input, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
    }).rotate()
    const metadata = await source.metadata()

    if (!metadata.width || !metadata.height) {
        throw new Error('Không đọc được kích thước ảnh')
    }

    const config = MEDIA_PROFILES[profile]
    const variants = await Promise.all(
        config.widths.map(async (targetWidth) => {
            const { data, info } = await sharp(input, {
                failOn: 'error',
                limitInputPixels: MAX_INPUT_PIXELS,
            })
                .rotate()
                .resize({
                    width: targetWidth,
                    withoutEnlargement: true,
                    fit: 'inside',
                })
                .webp({
                    quality: config.quality,
                    effort: 4,
                    smartSubsample: true,
                })
                .toBuffer({ resolveWithObject: true })

            return {
                buffer: data,
                width: info.width,
                height: info.height,
                bytes: info.size,
            }
        }),
    )

    return {
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
        variants,
    }
}
