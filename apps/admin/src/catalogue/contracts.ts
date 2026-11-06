export type AdminVariantOption = Readonly<{ axis: 'size' | 'seat_type'; value: string; label: string }>
export type AdminVariantAxis = Readonly<{ key: 'size' | 'seat_type'; label: string }>

export type AdminProduct = Readonly<{
  id: number
  sku: string
  name: string
  display_name: string | null
  slug: string
  description: string | null
  price: number | null
  original_price: number | null
  list_price: number | null
  sale_price: number | null
  online_discount_amount: number | null
  price_state: string
  price_confidence: string
  publication_status: string
  is_active: boolean
  pdp_visibility: string
  listing_visibility: string
  search_visibility: string
  seo_indexing: string
  sitemap_include: boolean
  image_main_url: string | null
  variant_group: string | null
  variant_group_id: number | null
  variant_type: 'size' | 'seat_type' | null
  variant_label: string | null
  variant_options: AdminVariantOption[]
  variant_axes: AdminVariantAxis[]
  variant_options_editable: boolean
  version: number
  updated_at: string
}>

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function identifier(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function money(value: unknown): number | null | undefined {
  if (value === null) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(number) && number >= 0 && number <= 1_000_000_000 ? number : undefined
}

function parseVariantOptions(value: unknown, type: 'size' | 'seat_type' | null): AdminVariantOption[] | null {
  if (!Array.isArray(value) || value.length > 1) return null
  if (value.length === 0) return []
  const option = record(value[0])
  if (!option || !type || option.axis !== type || typeof option.value !== 'string' || !option.value.trim()
    || option.value.length > 100 || typeof option.label !== 'string' || !option.label.trim() || option.label.length > 100) return null
  return [{ axis: type, value: option.value, label: option.label }]
}

function parseVariantAxes(value: unknown): AdminVariantAxis[] | null {
  if (!Array.isArray(value) || value.length > 1) return null
  if (value.length === 0) return []
  const axis = record(value[0])
  if (!axis || (axis.key !== 'size' && axis.key !== 'seat_type') || typeof axis.label !== 'string'
    || !axis.label.trim() || axis.label.length > 80) return null
  return [{ key: axis.key, label: axis.label }]
}

function parseProduct(value: unknown): AdminProduct | null {
  const row = record(value)
  const id = identifier(row?.id)
  const groupId = row?.variant_group_id === null ? null : identifier(row?.variant_group_id)
  const variantType = row?.variant_type === 'size' || row?.variant_type === 'seat_type' ? row.variant_type : null
  const price = money(row?.price)
  const originalPrice = money(row?.original_price)
  const listPrice = money(row?.list_price)
  const salePrice = money(row?.sale_price)
  const onlineDiscount = money(row?.online_discount_amount)
  const options = parseVariantOptions(row?.variant_options, variantType)
  const axes = parseVariantAxes(row?.variant_axes)
  if (!row || id === null || groupId === null && row.variant_group_id !== null
    || typeof row.sku !== 'string' || typeof row.name !== 'string'
    || (row.display_name !== null && typeof row.display_name !== 'string') || typeof row.slug !== 'string'
    || (row.description !== null && typeof row.description !== 'string')
    || price === undefined || originalPrice === undefined || listPrice === undefined || salePrice === undefined || onlineDiscount === undefined
    || typeof row.price_state !== 'string' || typeof row.price_confidence !== 'string'
    || typeof row.publication_status !== 'string' || typeof row.is_active !== 'boolean'
    || typeof row.pdp_visibility !== 'string' || typeof row.listing_visibility !== 'string'
    || typeof row.search_visibility !== 'string' || typeof row.seo_indexing !== 'string'
    || typeof row.sitemap_include !== 'boolean'
    || (row.image_main_url !== null && typeof row.image_main_url !== 'string')
    || (row.variant_group !== null && typeof row.variant_group !== 'string')
    || (row.variant_type !== null && variantType === null)
    || (row.variant_label !== null && typeof row.variant_label !== 'string')
    || options === null || axes === null || typeof row.variant_options_editable !== 'boolean'
    || identifier(row.version) === null || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) return null
  return {
    id, sku: row.sku, name: row.name, display_name: row.display_name as string | null, slug: row.slug, description: row.description as string | null,
    price, original_price: originalPrice, list_price: listPrice, sale_price: salePrice,
    online_discount_amount: onlineDiscount, price_state: row.price_state, price_confidence: row.price_confidence,
    publication_status: row.publication_status, is_active: row.is_active, pdp_visibility: row.pdp_visibility,
    listing_visibility: row.listing_visibility, search_visibility: row.search_visibility, seo_indexing: row.seo_indexing,
    sitemap_include: row.sitemap_include, image_main_url: row.image_main_url as string | null,
    variant_group: row.variant_group as string | null, variant_group_id: groupId, variant_type: variantType,
    variant_label: row.variant_label as string | null, variant_options: options, variant_axes: axes,
    variant_options_editable: row.variant_options_editable, version: identifier(row.version)!, updated_at: row.updated_at,
  }
}

export function parseAdminProductCatalogue(value: unknown): { products: AdminProduct[]; total: number } | null {
  const candidate = record(value)
  const total = candidate?.total === null ? null : typeof candidate?.total === 'number' ? candidate.total : Number(candidate?.total)
  if (!candidate || !Array.isArray(candidate.products) || !Number.isSafeInteger(total) || total! < 0) return null
  const products = candidate.products.map(parseProduct)
  return products.some((product) => product === null) ? null : { products: products as AdminProduct[], total: total! }
}

export function parseAdminProductSearch(value: unknown): { value: string; error: string | null } {
  const normalized = (value ?? '').toString().trim()
  if (normalized.length > 100) return { value: normalized.slice(0, 100), error: 'Từ khóa tối đa 100 ký tự.' }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return { value: '', error: 'Từ khóa có ký tự không hợp lệ.' }
  return { value: normalized, error: null }
}
