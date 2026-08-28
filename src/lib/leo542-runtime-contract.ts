export const LEO542_RUNTIME_CONTRACT = 'dongphugia:leo542-admin-publishing:v1'

export const LEO542_ENDPOINTS = {
  adminCommerce: 'admin-commerce',
  adminContent: 'admin-content',
  adminBlog: 'admin-blog',
  adminProducts: 'admin-products',
  adminAudit: 'admin-audit',
  publishingPosts: 'publishing-posts',
  publishingMedia: 'publishing-media',
} as const

type RuntimeOptions = {
  baseUrl: string
  publishableKey: string
  accessToken: () => Promise<string>
  fetch?: typeof fetch
}

export class Leo542RuntimeError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code)
    this.name = 'Leo542RuntimeError'
  }
}

export function createLeo542RuntimeClient(options: RuntimeOptions) {
  const requestFetch = options.fetch ?? fetch

  async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const token = await options.accessToken()
    const response = await requestFetch(`${options.baseUrl.replace(/\/$/, '')}/functions/v1/${endpoint}`, {
      ...init,
      headers: {
        apikey: options.publishableKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    })
    const payload = await response.json() as { data?: T; error?: { code?: string } }
    if (!response.ok) throw new Leo542RuntimeError(response.status, payload.error?.code ?? 'RUNTIME_OPERATION_FAILED')
    return payload.data as T
  }

  const mutation = (key: string, body: unknown, version?: number): RequestInit => ({
    method: 'PATCH',
    headers: {
      'Idempotency-Key': key,
      ...(version === undefined ? {} : { 'If-Match': String(version) }),
    },
    body: JSON.stringify(body),
  })

  return {
    contractVersion: LEO542_RUNTIME_CONTRACT,
    admin: {
      commerce: {
        list: <T>(resource: 'orders' | 'quotes' | 'customers') => request<T[]>(`${LEO542_ENDPOINTS.adminCommerce}?resource=${resource}`),
        patch: <T>(resource: 'orders' | 'quotes' | 'customers', id: number, patch: unknown, key: string) => request<T>(`${LEO542_ENDPOINTS.adminCommerce}?resource=${resource}`, mutation(key, { id, patch })),
      },
      content: {
        snapshot: <T>() => request<T>(LEO542_ENDPOINTS.adminContent),
        patch: <T>(resource: 'banner' | 'partner' | 'project', id: number, patch: unknown, key: string) => request<T>(LEO542_ENDPOINTS.adminContent, mutation(key, { resource, id, patch })),
      },
      blog: {
        list: <T>() => request<T[]>(LEO542_ENDPOINTS.adminBlog),
        create: <T>(input: unknown, key: string) => request<T>(LEO542_ENDPOINTS.adminBlog, { ...mutation(key, { input }), method: 'POST' }),
        update: <T>(id: number, expectedVersion: number, input: unknown, key: string) => request<T>(LEO542_ENDPOINTS.adminBlog, mutation(key, { id, expected_version: expectedVersion, input }, expectedVersion)),
      },
      products: {
        list: <T>() => request<T[]>(LEO542_ENDPOINTS.adminProducts),
        create: <T>(input: unknown, key: string) => request<T>(LEO542_ENDPOINTS.adminProducts, { ...mutation(key, { input }), method: 'POST' }),
        update: <T>(id: number, expectedVersion: number, input: unknown, key: string) => request<T>(LEO542_ENDPOINTS.adminProducts, mutation(key, { id, expected_version: expectedVersion, input }, expectedVersion)),
      },
      audit: { list: <T>() => request<T>(LEO542_ENDPOINTS.adminAudit) },
    },
    publishing: {
      posts: {
        list: <T>() => request<T[]>(LEO542_ENDPOINTS.publishingPosts),
        put: <T>(input: unknown, key: string, id?: number, expectedVersion?: number) => request<T>(LEO542_ENDPOINTS.publishingPosts, { ...mutation(key, { id, expected_version: expectedVersion, input }, expectedVersion), method: 'PUT' }),
      },
      media: {
        list: <T>() => request<T[]>(LEO542_ENDPOINTS.publishingMedia),
        reference: <T>(postId: number, mediaId: string, usage: string, key: string) => request<T>(LEO542_ENDPOINTS.publishingMedia, { ...mutation(key, { post_id: postId, media_id: mediaId, usage }), method: 'POST' }),
      },
    },
  }
}
