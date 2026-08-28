import { afterEach, describe, expect, it, vi } from 'vitest'

import worker, {
    LEO544_MEDIA_VARIANTS,
    type ImageBinding,
    type ImageTransformer,
    type Leo544WorkerEnv,
} from './index'

const AUTH_TOKEN = 'preview-only-test-token'

function env(overrides: Partial<Leo544WorkerEnv> = {}): Leo544WorkerEnv {
    const transformer: ImageTransformer = {
        transform: () => transformer,
        output: async () => ({
            response: () => new Response('webp-bytes', {
                headers: { 'Content-Type': 'image/webp' },
            }),
        }),
    }
    const defaultImages: ImageBinding = {
        input: () => transformer,
    }
    return {
        IMAGES: defaultImages,
        MEDIA_TRANSFORM_AUTH_TOKEN: AUTH_TOKEN,
        PUBLISHING_BUNNY_STORAGE_ENVIRONMENT: 'preview',
        PUBLISHING_BUNNY_STORAGE_ZONE_NAME: 'preview-zone',
        PUBLISHING_BUNNY_STORAGE_API_KEY: 'test-only-placeholder',
        PUBLISHING_BUNNY_STORAGE_HOSTNAME: 'sg.storage.bunnycdn.com',
        PUBLISHING_BUNNY_CDN_HOSTNAME: 'media.dongphugia.vn',
        ...overrides,
    }
}

function request(
    variant = 'inline.w640',
    body = 'RIFF1234WEBPsource-bytes',
    headers: Record<string, string> = {},
) {
    return new Request(
        `https://worker.example/v1/media-transform/identity-id/asset-id/${variant}`,
        {
            method: 'POST',
            body,
            headers: {
                Authorization: `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'image/webp',
                'X-Source-Height': '640',
                'X-Source-SHA256': '3fc7b8ed7cec080d7571b4e5aca5cdb81c53ace86f63680594e0dde8f1c7f297',
                'X-Source-Width': '960',
                ...headers,
            },
        },
    )
}

describe('LEO-544 Cloudflare Images stream transform', () => {
    afterEach(() => vi.restoreAllMocks())

    it('passes the request stream to Images and streams WebP output to Bunny', async () => {
        let input: ReadableStream<Uint8Array> | undefined
        let transformOptions: unknown
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
            expect(init?.method).toBe('PUT')
            expect(init?.headers).toMatchObject({
                AccessKey: 'test-only-placeholder',
                'Content-Type': 'image/webp',
            })
            expect(init?.body).toBeInstanceOf(ReadableStream)
            expect(await new Response(init?.body).text()).toBe('webp-bytes')
            return new Response(null, { status: 201 })
        })
        const images = {
            input(stream: ReadableStream<Uint8Array>) {
                input = stream
                return {
                    transform(options: unknown) {
                        transformOptions = options
                        return this
                    },
                    output: async () => ({
                        response: () => new Response('webp-bytes', {
                            headers: { 'Content-Type': 'image/webp' },
                        }),
                    }),
                }
            },
        }

        const response = await worker.fetch(
            request('thumbnail.w640'),
            env({ IMAGES: images }),
        )

        expect(response.status).toBe(201)
        expect(await response.json()).toEqual({
            delivery: 'bunny',
            format: 'webp',
            height: 360,
            path: 'publishing/identity-id/asset-id/3fc7b8ed7cec080d7571b4e5aca5cdb81c53ace86f63680594e0dde8f1c7f297/thumbnail.w640.webp',
            purpose: 'thumbnail',
            url: 'https://media.dongphugia.vn/publishing/identity-id/asset-id/3fc7b8ed7cec080d7571b4e5aca5cdb81c53ace86f63680594e0dde8f1c7f297/thumbnail.w640.webp',
            variant: 'thumbnail.w640',
            width: 640,
        })
        expect(input).toBeInstanceOf(ReadableStream)
        expect(await new Response(input).text()).toBe('RIFF1234WEBPsource-bytes')
        expect(transformOptions).toEqual({
            width: 640,
            height: 360,
            fit: 'cover',
            quality: 80,
            format: 'webp',
            metadata: 'keep',
        })
    })

    it('keeps the locked seven-variant envelope and preserves inline aspect ratio', async () => {
        expect(LEO544_MEDIA_VARIANTS).toHaveLength(7)
        const inline = LEO544_MEDIA_VARIANTS.find(({ id }) => id === 'inline.w960')
        expect(inline).toMatchObject({ width: 960, fit: 'scale-down', quality: 80 })
        expect(inline?.height).toBeUndefined()
    })

    it('fails closed before touching Images when the source is too large', async () => {
        const input = vi.fn()
        const response = await worker.fetch(
            request('inline.w640', 'small', { 'Content-Length': '5242881' }),
            env({ IMAGES: { input } }),
        )

        expect(response.status).toBe(413)
        expect(await response.json()).toEqual({ error: 'MEDIA_SOURCE_TOO_LARGE' })
        expect(input).not.toHaveBeenCalled()
    })

    it('does not activate without the Preview-only Bunny contract', async () => {
        const response = await worker.fetch(
            request(),
            env({ PUBLISHING_BUNNY_STORAGE_ENVIRONMENT: 'production' }),
        )

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'MEDIA_ENVIRONMENT_NOT_ALLOWED' })
    })

    it('rejects dimensions over the existing 40 megapixel limit', async () => {
        const response = await worker.fetch(
            request('inline.w640', 'small', {
                'X-Source-Height': '201',
                'X-Source-Width': '200000',
            }),
            env(),
        )

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({
            error: 'MEDIA_SOURCE_DIMENSIONS_TOO_LARGE',
        })
    })

    it('retries a transient Bunny failure with the same immutable object path', async () => {
        const bodies: string[] = []
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockImplementationOnce(async (_input, init) => {
                bodies.push(await new Response(init?.body).text())
                return new Response(null, { status: 503 })
            })
            .mockImplementationOnce(async (_input, init) => {
                bodies.push(await new Response(init?.body).text())
                return new Response(null, { status: 201 })
            })

        const response = await worker.fetch(request(), env())

        expect(response.status).toBe(201)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[0]?.[0]).toBe(fetchMock.mock.calls[1]?.[0])
        expect(bodies).toEqual(['webp-bytes', 'webp-bytes'])
    })
})
