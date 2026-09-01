import { createHash } from 'node:crypto'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import mediaWorker, {
    handleMediaPreviewRequest,
    type MediaPreviewEnv,
} from './worker'

const token = 'synthetic-backend-only-token'

async function samplePng(width = 1600, height = 800): Promise<Buffer> {
    return sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 36, g: 116, b: 142, alpha: 1 },
        },
    }).png().toBuffer()
}

function bindingFor() {
    return {
        info: async (stream: ReadableStream<Uint8Array>) => {
            const metadata = await sharp(Buffer.from(await new Response(stream).arrayBuffer())).metadata()
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
            }
        },
        input: (stream: ReadableStream<Uint8Array>) => ({
            transform: ({ width }: { width: number; fit: 'scale-down' }) => ({
                output: async ({ quality }: { format: 'image/webp'; quality: number }) => ({
                    response: async () => {
                        const bytes = Buffer.from(await new Response(stream).arrayBuffer())
                        return new Response(
                            await sharp(bytes)
                                .resize({ width, withoutEnlargement: true })
                                .webp({ quality })
                                .toBuffer(),
                            { status: 200 },
                        )
                    },
                }),
            }),
        }),
    }
}

function envFor(inputBytes: Uint8Array): MediaPreviewEnv {
    return {
        IMAGES: bindingFor(),
        MEDIA_TRANSFORM_AUTH_TOKEN: token,
        APP_ENV: 'preview',
        PREVIEW_NOINDEX: 'true',
    }
}

function requestFor(
    bytes: Uint8Array,
    targetWidth = 1280,
    overrides: Record<string, string> = {},
): Request {
    return new Request('https://media-preview.invalid/v1/transform', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'image/png',
            'x-dpg-media-profile': 'product-v1',
            'x-dpg-media-target-width': String(targetWidth),
            ...overrides,
        },
        body: bytes as unknown as BodyInit,
    })
}

describe('LEO-565 media transform Worker', () => {
    it('requires backend-only authorization and exposes no transform on GET', async () => {
        const bytes = await samplePng()
        const env = envFor(bytes)

        const unauthorized = await handleMediaPreviewRequest(
            new Request('https://media-preview.invalid/v1/transform', {
                method: 'POST',
                body: bytes as unknown as BodyInit,
            }),
            env,
        )
        expect(unauthorized.status).toBe(401)

        const getResponse = await mediaWorker.fetch(
            new Request('https://media-preview.invalid/v1/transform'),
            env,
        )
        expect(getResponse.status).toBe(405)
    })

    it('transforms a valid image with the locked profile and bounded width', async () => {
        const bytes = await samplePng()
        const response = await handleMediaPreviewRequest(
            requestFor(bytes),
            envFor(bytes),
        )
        const output = Buffer.from(await response.arrayBuffer())

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/webp')
        expect(response.headers.get('x-dpg-media-profile')).toBe('product-v1')
        expect(response.headers.get('x-dpg-media-target-width')).toBe('1280')
        expect((await sharp(output).metadata()).width).toBe(1280)
        expect(createHash('sha256').update(output).digest('hex')).toMatch(/^[a-f0-9]{64}$/)
    })

    it('denies MIME spoofing, malformed bytes, oversized input, and upscaling', async () => {
        const bytes = await samplePng(500, 250)
        const env = envFor(bytes)

        const spoofed = await handleMediaPreviewRequest(
            requestFor(bytes, 320, { 'content-type': 'image/jpeg' }),
            env,
        )
        expect(spoofed.status).toBe(415)
        await expect(spoofed.json()).resolves.toMatchObject({ error: 'MEDIA_SIGNATURE_MISMATCH' })

        const malformed = await handleMediaPreviewRequest(
            requestFor(Buffer.from('not an image'), 320),
            env,
        )
        expect(malformed.status).toBe(415)

        const oversized = await handleMediaPreviewRequest(
            requestFor(new Uint8Array(5 * 1024 * 1024 + 1), 320),
            env,
        )
        expect(oversized.status).toBe(413)

        const upscale = await handleMediaPreviewRequest(
            requestFor(bytes, 1280),
            env,
        )
        expect(upscale.status).toBe(422)
        await expect(upscale.json()).resolves.toMatchObject({ error: 'MEDIA_UPSCALE_REJECTED' })
    })

    it('denies an invalid profile or target width before provider work', async () => {
        const bytes = await samplePng()
        const env = envFor(bytes)

        const wrongProfile = await handleMediaPreviewRequest(
            requestFor(bytes, 320, { 'x-dpg-media-profile': 'blog-seven' }),
            env,
        )
        expect(wrongProfile.status).toBe(422)

        const wrongWidth = await handleMediaPreviewRequest(
            requestFor(bytes, 321),
            env,
        )
        expect(wrongWidth.status).toBe(422)
    })
})
