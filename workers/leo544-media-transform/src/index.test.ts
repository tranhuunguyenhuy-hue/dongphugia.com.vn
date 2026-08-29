import { afterEach, describe, expect, it, vi } from 'vitest'

import worker, {
    LEO544_MEDIA_VARIANTS,
    type ImageBinding,
    type ImageInfo,
    type ImageTransformer,
    type Leo544WorkerEnv,
} from './index'

const AUTH_TOKEN = 'preview-only-test-token'
const JPEG_SOURCE = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
const PNG_SOURCE = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])
const WEBP_SOURCE = new TextEncoder().encode('RIFF1234WEBPsource-bytes')
const DEFAULT_WEBP_SOURCE = 'RIFF1234WEBPsource-bytes'

async function digest(body: BodyInit) {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer())
    const result = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(result)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

function defaultInfo(overrides: Partial<ImageInfo> = {}): ImageInfo {
    return {
        format: 'image/webp',
        fileSize: DEFAULT_WEBP_SOURCE.length,
        width: 960,
        height: 640,
        ...overrides,
    }
}

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
        info: async () => defaultInfo(),
        input: () => transformer,
    }
    return {
        IMAGES: defaultImages,
        MEDIA_TRANSFORM_AUTH_TOKEN: AUTH_TOKEN,
        PUBLISHING_BUNNY_STORAGE_ENVIRONMENT: 'preview',
        PUBLISHING_BUNNY_STORAGE_ZONE_NAME: 'preview-zone',
        PUBLISHING_BUNNY_STORAGE_API_KEY: 'test-only-placeholder',
        PUBLISHING_BUNNY_STORAGE_HOSTNAME: 'sg.storage.bunnycdn.com',
        PUBLISHING_BUNNY_CDN_HOSTNAME: 'dpg-publishing-staging.b-cdn.net',
        ...overrides,
    }
}

async function requestAtPath(
    identityId: string,
    assetId: string,
    variant = 'inline.w640',
    body: BodyInit = DEFAULT_WEBP_SOURCE,
    headers: Record<string, string> = {},
) {
    return new Request(
        `https://worker.example/v1/media-transform/${identityId}/${assetId}/${variant}`,
        {
            method: 'POST',
            body,
            headers: {
                Authorization: `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'image/webp',
                'X-Source-SHA256': await digest(body),
                ...headers,
            },
        },
    )
}

async function requestAt(
    identityId: string,
    variant = 'inline.w640',
    body: BodyInit = DEFAULT_WEBP_SOURCE,
    headers: Record<string, string> = {},
) {
    return requestAtPath(identityId, 'run-test', variant, body, headers)
}

async function request(
    variant = 'inline.w640',
    body: BodyInit = DEFAULT_WEBP_SOURCE,
    headers: Record<string, string> = {},
) {
    return requestAt('leo544-acceptance', variant, body, headers)
}

function imagesWithInfo(info: ImageInfo | { format: string }): ImageBinding {
    const transformer: ImageTransformer = {
        transform: () => transformer,
        output: async () => ({
            response: () => new Response('webp-bytes', {
                headers: { 'Content-Type': 'image/webp' },
            }),
        }),
    }
    return {
        info: async () => info,
        input: () => transformer,
    }
}

describe('LEO-544 Cloudflare Images stream transform', () => {
    afterEach(() => vi.restoreAllMocks())

    it('passes the bounded source to Images and streams WebP output to Bunny', async () => {
        let input: ReadableStream<Uint8Array> | undefined
        let infoInput: ReadableStream<Uint8Array> | undefined
        let transformOptions: unknown
        let outputOptions: unknown
        const images: ImageBinding = {
            info: async (stream) => {
                infoInput = stream
                return defaultInfo()
            },
            input(stream) {
                input = stream
                return {
                    transform(options: unknown) {
                        transformOptions = options
                        return this
                    },
                    output: async (options) => {
                        outputOptions = options
                        return {
                            response: () => new Response('webp-bytes', {
                                headers: { 'Content-Type': 'image/webp' },
                            }),
                        }
                    },
                }
            },
        }
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
            if (init?.method === 'GET') return new Response(null, { status: 404 })
            expect(init?.method).toBe('PUT')
            expect(init?.headers).toMatchObject({
                AccessKey: 'test-only-placeholder',
                'Content-Type': 'image/webp',
                Checksum: (await digest('webp-bytes')).toUpperCase(),
            })
            expect(init?.body).toBeInstanceOf(ReadableStream)
            expect(await new Response(init?.body).text()).toBe('webp-bytes')
            return new Response(null, { status: 201 })
        })

        const response = await worker.fetch(
            await request('thumbnail.w640'),
            env({ IMAGES: images }),
        )

        expect(response.status).toBe(201)
        expect(await response.json()).toEqual({
            delivery: 'bunny',
            format: 'webp',
            height: 360,
            path: `publishing/leo544-acceptance/run-test/${await digest(DEFAULT_WEBP_SOURCE)}/${await digest('webp-bytes')}/thumbnail.w640.webp`,
            purpose: 'thumbnail',
            url: `https://dpg-publishing-staging.b-cdn.net/publishing/leo544-acceptance/run-test/${await digest(DEFAULT_WEBP_SOURCE)}/${await digest('webp-bytes')}/thumbnail.w640.webp`,
            variant: 'thumbnail.w640',
            width: 640,
        })
        expect(input).toBeInstanceOf(ReadableStream)
        expect(infoInput).toBeInstanceOf(ReadableStream)
        expect(await new Response(input).text()).toBe('RIFF1234WEBPsource-bytes')
        expect(transformOptions).toEqual({ width: 640, height: 360, fit: 'cover' })
        expect(outputOptions).toEqual({ format: 'image/webp', quality: 80 })
    })

    it('keeps the locked seven-variant envelope and calculates inline output dimensions', async () => {
        expect(LEO544_MEDIA_VARIANTS).toHaveLength(7)
        const inline = LEO544_MEDIA_VARIANTS.find(({ id }) => id === 'inline.w960')
        expect(inline).toMatchObject({ width: 960, fit: 'scale-down', quality: 80 })
        expect(inline?.height).toBeUndefined()

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
            if (init?.method === 'GET') return new Response(null, { status: 404 })
            await new Response(init?.body).arrayBuffer()
            return new Response(null, { status: 201 })
        })
        const req = await request('inline.w960')
        const response = await worker.fetch(
            req,
            env({ IMAGES: imagesWithInfo(defaultInfo({ width: 1200, height: 800 })) }),
        )
        expect(response.status).toBe(201)
        expect(await response.json()).toMatchObject({ width: 960, height: 640 })
    })

    it('fails closed before touching Images when the source is too large', async () => {
        const input = vi.fn()
        const response = await worker.fetch(
            await request('inline.w640', 'small', { 'Content-Length': '5242881' }),
            env({
                IMAGES: {
                    info: vi.fn(),
                    input,
                },
            }),
        )

        expect(response.status).toBe(413)
        expect(await response.json()).toEqual({ error: 'MEDIA_SOURCE_TOO_LARGE' })
        expect(input).not.toHaveBeenCalled()
    })

    it('does not activate without the Preview-only Bunny contract', async () => {
        const response = await worker.fetch(
            await request(),
            env({ PUBLISHING_BUNNY_STORAGE_ENVIRONMENT: 'production' }),
        )

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'MEDIA_ENVIRONMENT_NOT_ALLOWED' })
    })

    it('rejects a Production Bunny CDN hostname before transforming', async () => {
        const input = vi.fn()
        const response = await worker.fetch(
            await request(),
            env({
                IMAGES: { info: vi.fn(), input },
                PUBLISHING_BUNNY_CDN_HOSTNAME: 'media.dongphugia.vn',
            }),
        )

        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ error: 'MEDIA_STORAGE_NOT_CONFIGURED' })
        expect(input).not.toHaveBeenCalled()
    })

    it.each([
        ['JPEG', 'image/jpeg', JPEG_SOURCE],
        ['PNG', 'image/png', PNG_SOURCE],
        ['WebP', 'image/webp', WEBP_SOURCE],
    ] as const)('rejects a %s whose actual dimensions exceed 40MP', async (_name, contentType, body) => {
        const response = await worker.fetch(
            await request('inline.w640', body, { 'Content-Type': contentType }),
            env({
                IMAGES: imagesWithInfo({
                    format: contentType,
                    fileSize: body.byteLength,
                    width: 8001,
                    height: 5000,
                }),
            }),
        )

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({
            error: 'MEDIA_SOURCE_DIMENSIONS_TOO_LARGE',
        })
    })

    it('rejects claimed dimensions smaller than the actual parsed dimensions', async () => {
        const response = await worker.fetch(
            await request('inline.w640', JPEG_SOURCE, {
                'Content-Type': 'image/jpeg',
                'X-Source-Width': '1',
                'X-Source-Height': '1',
            }),
            env({
                IMAGES: imagesWithInfo({
                    format: 'image/jpeg',
                    fileSize: JPEG_SOURCE.byteLength,
                    width: 10000,
                    height: 5000,
                }),
            }),
        )

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({
            error: 'MEDIA_SOURCE_DIMENSIONS_TOO_LARGE',
        })
    })

    it('rejects malformed or incomplete dimension metadata', async () => {
        const response = await worker.fetch(
            await request(),
            env({ IMAGES: imagesWithInfo({ format: 'image/webp', width: 0, height: 640 }) }),
        )

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({
            error: 'MEDIA_SOURCE_DIMENSIONS_INVALID',
        })
    })

    it('accepts normal independently parsed JPEG, PNG, and WebP dimensions', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
            if (init?.method === 'GET') return new Response(null, { status: 404 })
            await new Response(init?.body).arrayBuffer()
            return new Response(null, { status: 201 })
        })
        for (const [contentType, body] of [
            ['image/jpeg', JPEG_SOURCE],
            ['image/png', PNG_SOURCE],
            ['image/webp', WEBP_SOURCE],
        ] as const) {
            const response = await worker.fetch(
                await request('inline.w640', body, { 'Content-Type': contentType }),
                env({
                    IMAGES: imagesWithInfo({
                        format: contentType,
                        fileSize: body.byteLength,
                        width: 1600,
                        height: 900,
                    }),
                }),
            )
            expect(response.status).toBe(201)
        }
    })

    it('does not PUT when replaying the same immutable object', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
            expect(init?.method).toBe('GET')
            return new Response('webp-bytes', { status: 200 })
        })

        const response = await worker.fetch(await request(), env())

        expect(response.status).toBe(201)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('fails closed when an existing path contains different bytes', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
            expect(init?.method).toBe('GET')
            return new Response('different-bytes', { status: 200 })
        })

        const response = await worker.fetch(await request(), env())

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({ error: 'MEDIA_STORAGE_CONFLICT' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('keeps concurrent duplicate writes on the same content-addressed path and bytes', async () => {
        const puts: Array<{ url: string; body: string; checksum: string }> = []
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
            if (init?.method === 'GET') return new Response(null, { status: 404 })
            const body = await new Response(init?.body).text()
            puts.push({
                url: String(input),
                body,
                checksum: String(new Headers(init?.headers).get('Checksum')),
            })
            return new Response(null, { status: 201 })
        })

        const [first, second] = await Promise.all([
            worker.fetch(await request(), env()),
            worker.fetch(await request(), env()),
        ])

        expect(first.status).toBe(201)
        expect(second.status).toBe(201)
        expect(puts).toHaveLength(2)
        expect(puts[0]).toEqual(puts[1])
        expect(puts[0]?.body).toBe('webp-bytes')
    })

    it('rejects canonical identities before any Bunny request', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
        const response = await worker.fetch(
            await requestAt('canonical-user'),
            env(),
        )

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'MEDIA_SYNTHETIC_SCOPE_REQUIRED' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects non-run assets even inside the synthetic identity', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
        const response = await worker.fetch(
            await requestAtPath('leo544-acceptance', 'canonical-asset'),
            env(),
        )

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'MEDIA_SYNTHETIC_SCOPE_REQUIRED' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('retries a transient Bunny failure with the same immutable object path', async () => {
        const bodies: string[] = []
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockImplementationOnce(async (_input, init) => new Response(null, { status: 404 }))
            .mockImplementationOnce(async (_input, init) => {
                bodies.push(await new Response(init?.body).text())
                return new Response(null, { status: 503 })
            })
            .mockImplementationOnce(async (_input, init) => {
                bodies.push(await new Response(init?.body).text())
                return new Response(null, { status: 201 })
            })

        const response = await worker.fetch(await request(), env())

        expect(response.status).toBe(201)
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(fetchMock.mock.calls[1]?.[0]).toBe(fetchMock.mock.calls[2]?.[0])
        expect(bodies).toEqual(['webp-bytes', 'webp-bytes'])
    })
})
