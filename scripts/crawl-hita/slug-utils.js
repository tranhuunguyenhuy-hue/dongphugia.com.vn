export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function removeTrailingHitaId(slug) {
  const value = String(slug || '').trim().replace(/\.html$/i, '')
  if (!value) return ''
  const parts = value.split('-').filter(Boolean)
  if (parts.length > 1 && /^\d{3,}$/.test(parts[parts.length - 1])) {
    parts.pop()
  }
  return parts.join('-')
}

export function cleanHitaPathSlug(sourceUrl) {
  if (!sourceUrl) return ''

  try {
    const parsed = new URL(String(sourceUrl).trim(), 'https://hita.com.vn')
    const pathname = decodeURIComponent(parsed.pathname || '')
      .replace(/^\/+/, '')
      .replace(/\.html$/i, '')
      .split('/')
      .filter(Boolean)
      .pop() || ''
    return removeTrailingHitaId(pathname)
  } catch {
    return removeTrailingHitaId(String(sourceUrl).trim().replace(/^\/+/, ''))
  }
}

export function buildStableProductSlug({
  sourceUrl,
  taxonomy = {},
  brandSlug = '',
  sku = '',
  name = '',
  variantLabel = '',
  activeVariantLabel = '',
}) {
  const cleanedPathSlug = cleanHitaPathSlug(sourceUrl)
  const variantSuffix = slugify(activeVariantLabel || variantLabel)

  if (cleanedPathSlug) {
    return slugify([cleanedPathSlug, variantSuffix].filter(Boolean).join('-'))
  }

  const syntheticSku = /^HITA-/i.test(String(sku || '').trim()) ? '' : String(sku || '').trim()
  const typePart = taxonomy?.product_sub_type || taxonomy?.product_type || ''
  const fallbackParts = [typePart, brandSlug, syntheticSku, variantSuffix, name]
    .filter(Boolean)
    .map((part) => slugify(part))
    .filter(Boolean)

  return fallbackParts.join('-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

