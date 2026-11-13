import { describe, expect, it, vi } from 'vitest'
import { fetchBoundedPublicJson } from './fetch-public-candidate.mjs'

describe('public source fetch boundary', () => {
  it('uses a fixed public origin, GET, omitted credentials and manual redirects', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const body = await fetchBoundedPublicJson('manifest.json', fetchImpl)
    expect(body.toString()).toBe('{"ok":true}')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe('https://www.dongphugia.vn/__catalogue/v1/manifest.json')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('omit')
    expect(init.redirect).toBe('manual')
  })

  it('rejects redirects, cookies, excessive size and non-allowlisted paths', async () => {
    await expect(fetchBoundedPublicJson('manifest.json', async () => new Response(null, { status: 302 })))
      .rejects.toThrow('PUBLIC_ASSET_RESPONSE_REJECTED')
    await expect(fetchBoundedPublicJson('manifest.json', async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': 'session=not-used' },
    }))).rejects.toThrow('PUBLIC_ASSET_RESPONSE_REJECTED')
    await expect(fetchBoundedPublicJson('manifest.json', async () => new Response('', {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '2000001' },
    }))).rejects.toThrow('PUBLIC_ASSET_RESPONSE_REJECTED')
    await expect(fetchBoundedPublicJson('../secrets.json', async () => new Response('{}')))
      .rejects.toThrow('PUBLIC_ASSET_PATH_FORBIDDEN')
  })
})
