/**
 * Stable transport contract for the future Admin/Publishing adapters.
 *
 * This module carries only a public Supabase URL and a caller access token.
 * It never accepts, stores, or names a service-role/secret key.
 */
export const SUPABASE_RUNTIME_CONTRACT_VERSION = 'dongphugia:supabase-runtime:v1'

export const SUPABASE_RUNTIME_ENDPOINTS = {
  orders: 'commerce-orders',
  quotes: 'commerce-quotes',
} as const

export type InstallOption = 'none' | 'install' | 'replace'
export type OrderStatus = 'pending' | 'received' | 'confirmed' | 'inventory_check' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type QuoteStatus = 'pending' | 'contacted' | 'quoted' | 'resolved' | 'completed' | 'cancelled'

export type OrderCreateInput = {
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_address?: string
  note?: string
  items: Array<{ productId: number; quantity: number; installOption?: InstallOption }>
}

export type QuoteCreateInput = {
  name: string
  phone: string
  email?: string
  message?: string
  products?: Array<{ product_id: number; quantity?: number; note?: string | null }>
}

export type OrderPatch = Partial<{
  status: OrderStatus
  payment_status: PaymentStatus
  note: string | null
  shipping_fee: number
  discount: number
  vat_rate: number
}>

export type QuotePatch = Partial<{ status: QuoteStatus; message: string | null }>

export type RuntimeOrder = {
  id: number
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  customer_address: string | null
  note: string | null
  subtotal: number
  shipping_fee: number
  discount: number
  vat_rate: number
  total: number
  status: OrderStatus
  payment_method: string | null
  payment_status: PaymentStatus
  created_at: string
  updated_at: string
  items: Array<{
    id: number
    product_id: number
    product_name: string
    product_sku: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}

export type RuntimeQuote = {
  id: number
  quote_number: string
  name: string
  phone: string
  email: string | null
  message: string | null
  status: QuoteStatus
  created_at: string
  updated_at: string
  items: Array<{
    id: number
    product_id: number
    quantity: number
    note: string | null
    product_sku_snapshot: string | null
    product_name_snapshot: string | null
    commerce_mode_snapshot: 'PUBLIC_PRICE' | 'CONTACT_FOR_QUOTE' | null
    availability_snapshot: 'InStock' | 'PreOrder' | 'QuoteOnly' | 'Discontinued' | null
    list_price_snapshot: number | null
    sale_price_snapshot: number | null
    snapshot_at: string | null
  }>
}

export type RuntimeMutationResult = {
  order_id?: number
  order_number?: string
  quote_id?: number
  quote_number?: string
  total?: number
  status?: string
  payment_status?: string
  item_count?: number
}

export class SupabaseRuntimeApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(code)
    this.name = 'SupabaseRuntimeApiError'
  }
}

export type RuntimeClient = ReturnType<typeof createSupabaseRuntimeClient>

export function createSupabaseRuntimeClient(options: {
  baseUrl: string
  getAccessToken: () => string | Promise<string>
  fetchImpl?: typeof fetch
}) {
  const baseUrl = options.baseUrl.replace(/\/$/, '')
  const fetchImpl = options.fetchImpl ?? fetch

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getAccessToken()
    if (!token) throw new SupabaseRuntimeApiError(401, 'UNAUTHORIZED')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Content-Type', 'application/json')
    const response = await fetchImpl(`${baseUrl}/functions/v1/${path}`, { ...init, headers })
    let body: unknown = null
    try { body = await response.json() } catch { /* handled as an opaque error */ }
    if (!response.ok) {
      const error = body && typeof body === 'object' && 'error' in body
        ? (body as { error?: { code?: unknown; request_id?: unknown } }).error
        : undefined
      throw new SupabaseRuntimeApiError(
        response.status,
        typeof error?.code === 'string' ? error.code : 'RUNTIME_OPERATION_FAILED',
        typeof error?.request_id === 'string' ? error.request_id : undefined,
      )
    }
    return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T
  }

  const idempotent = (key: string): HeadersInit => ({ 'Idempotency-Key': key })
  return {
    contractVersion: SUPABASE_RUNTIME_CONTRACT_VERSION,
    orders: {
      create: (input: OrderCreateInput, key: string) => request<RuntimeMutationResult>(SUPABASE_RUNTIME_ENDPOINTS.orders, { method: 'POST', headers: idempotent(key), body: JSON.stringify(input) }),
      get: (id: number) => request<RuntimeOrder>(`${SUPABASE_RUNTIME_ENDPOINTS.orders}?id=${encodeURIComponent(id)}`),
      list: (limit = 25, offset = 0) => request<RuntimeOrder[]>(`${SUPABASE_RUNTIME_ENDPOINTS.orders}?limit=${limit}&offset=${offset}`),
      update: (id: number, patch: OrderPatch, key: string) => request<RuntimeMutationResult>(SUPABASE_RUNTIME_ENDPOINTS.orders, { method: 'PATCH', headers: idempotent(key), body: JSON.stringify({ id, patch }) }),
      delete: (id: number, key: string) => request<RuntimeMutationResult>(`${SUPABASE_RUNTIME_ENDPOINTS.orders}?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: idempotent(key) }),
    },
    quotes: {
      create: (input: QuoteCreateInput, key: string) => request<RuntimeMutationResult>(SUPABASE_RUNTIME_ENDPOINTS.quotes, { method: 'POST', headers: idempotent(key), body: JSON.stringify(input) }),
      get: (id: number) => request<RuntimeQuote>(`${SUPABASE_RUNTIME_ENDPOINTS.quotes}?id=${encodeURIComponent(id)}`),
      list: (limit = 25, offset = 0) => request<RuntimeQuote[]>(`${SUPABASE_RUNTIME_ENDPOINTS.quotes}?limit=${limit}&offset=${offset}`),
      update: (id: number, patch: QuotePatch, key: string) => request<RuntimeMutationResult>(SUPABASE_RUNTIME_ENDPOINTS.quotes, { method: 'PATCH', headers: idempotent(key), body: JSON.stringify({ id, patch }) }),
      delete: (id: number, key: string) => request<RuntimeMutationResult>(`${SUPABASE_RUNTIME_ENDPOINTS.quotes}?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: idempotent(key) }),
    },
  }
}
