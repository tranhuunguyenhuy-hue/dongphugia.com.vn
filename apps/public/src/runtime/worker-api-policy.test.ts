import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    vinextFetch: vi.fn(async () => Response.json({ ok: true })),
    servePrerendered: vi.fn(async () => null),
}))

vi.mock('vinext/server/fetch-handler', () => ({ default: { fetch: mocks.vinextFetch } }))
vi.mock('./prerendered-catalogue', () => ({ servePrerenderedCatalogue: mocks.servePrerendered }))

let worker: typeof import('../../worker')['default']
const environment = {
    APP_ENV: 'preview',
    APP_BUILD_TARGET: 'public',
    APP_ORIGIN: 'https://preview.invalid',
    PREVIEW_NOINDEX: 'true',
}

beforeAll(async () => {
    vi.stubGlobal('__DPG_BUILD_SOURCE_SHA__', 'a'.repeat(40))
    vi.stubEnv('PUBLIC_CATALOGUE_CHECKPOINT', '')
    worker = (await import('../../worker')).default
})

beforeEach(() => mocks.vinextFetch.mockClear())

describe('public Worker API route ownership', () => {
    it('routes only the owned listing read endpoint through to the public app', async () => {
        const request = new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen?page=1')
        const response = await worker.fetch(request, environment, {} as ExecutionContext)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(mocks.vinextFetch).toHaveBeenCalledTimes(1)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    })

    it('blocks write methods and unowned API paths before the app handler', async () => {
        const write = await worker.fetch(
            new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen', { method: 'POST' }),
            environment,
            {} as ExecutionContext,
        )
        const unknown = await worker.fetch(
            new Request('https://preview.invalid/api/private/export'),
            environment,
            {} as ExecutionContext,
        )
        expect(write.status).toBe(405)
        expect(write.headers.get('allow')).toBe('GET, HEAD')
        expect(unknown.status).toBe(404)
        expect(mocks.vinextFetch).not.toHaveBeenCalled()
    })
})
