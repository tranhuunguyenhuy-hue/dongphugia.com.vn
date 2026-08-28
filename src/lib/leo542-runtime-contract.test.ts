import { describe, expect, it, vi } from 'vitest'
import { createLeo542RuntimeClient, LEO542_ENDPOINTS, LEO542_RUNTIME_CONTRACT, Leo542RuntimeError } from './leo542-runtime-contract'

describe('LEO-542 runtime client', () => {
  it('propagates the caller JWT and idempotency/version headers without privileged credentials', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ data: { id: 7, version: 2 } }), { status: 200 }))
    const client = createLeo542RuntimeClient({ baseUrl: 'https://runtime.example', publishableKey: 'public-key', accessToken: async () => 'user-jwt', fetch: request as typeof fetch })
    expect(client.contractVersion).toBe(LEO542_RUNTIME_CONTRACT)
    await client.admin.blog.update(7, 1, { status: 'published' }, 'leo542-key')
    expect(request).toHaveBeenCalledWith(`https://runtime.example/functions/v1/${LEO542_ENDPOINTS.adminBlog}`, expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({ authorization: 'Bearer user-jwt', apikey: 'public-key', 'Idempotency-Key': 'leo542-key', 'If-Match': '1' }),
    }))
    expect(JSON.stringify(request.mock.calls)).not.toMatch(/service.role|database_url|password/i)
  })

  it('returns only the sanitized runtime error code', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 }))
    const client = createLeo542RuntimeClient({ baseUrl: 'https://runtime.example', publishableKey: 'public-key', accessToken: async () => 'user-jwt', fetch: request as typeof fetch })
    await expect(client.admin.audit.list()).rejects.toEqual(new Leo542RuntimeError(403, 'FORBIDDEN'))
  })
})
