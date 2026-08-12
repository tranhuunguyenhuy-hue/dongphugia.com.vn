// @vitest-environment node

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { processPublishingImage } from './media'

describe('processPublishingImage', () => {
    it('creates immutable 16:9 thumbnail variants', async () => {
        const source = await sharp({
            create: {
                width: 1200,
                height: 1200,
                channels: 3,
                background: '#25738e',
            },
        })
            .jpeg()
            .toBuffer()

        const result = await processPublishingImage(
            source,
            'image/jpeg',
            'thumbnail',
        )

        expect(result.variants.map(({ width, height }) => [width, height])).toEqual([
            [640, 360],
            [960, 540],
        ])
        expect(result.variants.every(({ format }) => format === 'webp')).toBe(
            true,
        )
    })

    it('rejects GIF rather than passing animated source bytes through', async () => {
        const source = await sharp({
            create: {
                width: 10,
                height: 10,
                channels: 3,
                background: '#25738e',
            },
        })
            .gif()
            .toBuffer()

        await expect(
            processPublishingImage(source, 'image/gif', 'inline'),
        ).rejects.toMatchObject({
            status: 422,
            code: 'MEDIA_TYPE_UNSUPPORTED',
        })
    })
})
