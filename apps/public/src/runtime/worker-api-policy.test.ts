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
    it('identifies and keeps read-only receipt responses private and noindex in Preview', async () => {
        const restoreFetch = globalThis.fetch
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: null })))
        try {
            const request = new Request('https://preview.invalid/api/order-requests/receipt', {
                headers: { 'Idempotency-Key': '8b96aecb-8c34-4c46-879f-292369aa961d' },
            })
            const response = await worker.fetch(request, {
                ...environment,
                PUBLIC_ORDER_INTAKE_URL: 'https://demo.supabase.co/functions/v1/order-intake',
                PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
                ORDER_INTAKE_SIGNING_SECRET: 'synthetic-order-intake-signing-secret-32-bytes',
                ORDER_REQUEST_LIMITER: { limit: async () => ({ success: true }) },
            }, {} as ExecutionContext)

            expect(response.status).toBe(200)
            expect(await response.json()).toEqual({ data: null })
            expect(response.headers.get('cache-control')).toBe('private, no-store')
            expect(response.headers.get('x-dpg-source-sha')).toBe('a'.repeat(40))
            expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
        } finally {
            vi.stubGlobal('fetch', restoreFetch)
        }
    })

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
