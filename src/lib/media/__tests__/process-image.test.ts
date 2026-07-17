import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { processImage } from '@/lib/media/process-image'

describe('processImage', () => {
    it('creates WebP product variants without enlarging the source', async () => {
        const input = await sharp({
            create: {
                width: 500,
                height: 250,
                channels: 4,
                background: '#25738e',
            },
        })
            .png()
            .toBuffer()

        const result = await processImage(input, 'product')

        expect(result.variants).toHaveLength(2)
        expect(result.variants[0]).toMatchObject({ width: 320, height: 160 })
        expect(result.variants[1]).toMatchObject({ width: 500, height: 250 })

        for (const variant of result.variants) {
            const metadata = await sharp(variant.buffer).metadata()
            expect(metadata.format).toBe('webp')
            expect(variant.bytes).toBeLessThan(input.byteLength)
        }
    })

    it('keeps transparent pixels when converting PNG to WebP', async () => {
        const input = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 },
            },
        })
            .png()
            .toBuffer()

        const result = await processImage(input, 'editorial')
        const metadata = await sharp(result.variants[0].buffer).metadata()

        expect(metadata.hasAlpha).toBe(true)
        expect(metadata.width).toBe(100)
    })
})
