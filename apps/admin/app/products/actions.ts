'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { getAdminProductCatalogue } from '../../src/catalogue/queries'
import { createAdminServerClient } from '../../src/supabase/server'

function amount(value: FormDataEntryValue | null): number | null | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized) return null
  if (!/^\d{1,10}$/.test(normalized)) return undefined
  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) && parsed <= 1_000_000_000 ? parsed : undefined
}

function stringField(formData: FormData, key: string, limit: number): string | null {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (normalized.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) return null
  return normalized
}

export async function updateAdminProduct(formData: FormData): Promise<never> {
  const staff = await requireActiveStaff()
  const id = Number(formData.get('productId'))
  const expectedVersion = Number(formData.get('version'))
  const idempotencyKey = formData.get('idempotencyKey')
  const fallback = `/products/${Number.isSafeInteger(id) && id > 0 ? id : ''}`
  if (!staff.capabilities.includes('products:write')) redirect('/products?error=forbidden')
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
    || typeof idempotencyKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(idempotencyKey)) redirect('/products?error=invalid')

  const currentResult = await getAdminProductCatalogue({ productId: id, limit: 1 })
  const current = currentResult?.products[0]
  if (!current) redirect('/products?error=unavailable')
  if (current.version !== expectedVersion) redirect(`${fallback}?error=stale`)

  const nextPrice = amount(formData.get('price'))
  const nextSalePrice = amount(formData.get('salePrice'))
  const nextDiscount = amount(formData.get('onlineDiscountAmount'))
  const displayName = stringField(formData, 'displayName', 500)
  const description = stringField(formData, 'description', 20000)
  const publicationStatus = formData.get('publicationStatus')
  const pdpVisibility = formData.get('pdpVisibility')
  const listingVisibility = formData.get('listingVisibility')
  const searchVisibility = formData.get('searchVisibility')
  const seoIndexing = formData.get('seoIndexing')
  const isActive = formData.get('isActive') === 'on'
  const sitemapInclude = formData.get('sitemapInclude') === 'on'
  if (nextPrice === undefined || nextSalePrice === undefined || nextDiscount === undefined || displayName === null || description === null
    || (publicationStatus !== 'draft' && publicationStatus !== 'public')
    || (pdpVisibility !== 'public' && pdpVisibility !== 'hidden')
    || !['default', 'public', 'hidden'].includes(String(listingVisibility))
    || (searchVisibility !== 'visible' && searchVisibility !== 'hidden')
    || (seoIndexing !== 'index' && seoIndexing !== 'noindex')) redirect(`${fallback}?error=invalid`)

  const input: Record<string, unknown> = {}
  if (displayName !== (current.display_name ?? current.name)) input.display_name = displayName
  if (description !== (current.description ?? '')) input.description = description
  if (nextPrice !== current.price) input.price = nextPrice
  if (nextSalePrice !== current.sale_price) input.sale_price = nextSalePrice
  if (nextDiscount !== current.online_discount_amount) input.online_discount_amount = nextDiscount
  if (publicationStatus !== current.publication_status) input.publication_status = publicationStatus
  if (isActive !== current.is_active) input.is_active = isActive
  if (pdpVisibility !== current.pdp_visibility) input.pdp_visibility = pdpVisibility
  if (listingVisibility !== current.listing_visibility) input.listing_visibility = listingVisibility
  if (searchVisibility !== current.search_visibility) input.search_visibility = searchVisibility
  if (seoIndexing !== current.seo_indexing) input.seo_indexing = seoIndexing
  if (sitemapInclude !== current.sitemap_include) input.sitemap_include = sitemapInclude

  if (current.variant_options_editable && current.variant_type) {
    const variantLabel = stringField(formData, 'variantLabel', 100)
    const variantValue = stringField(formData, 'variantValue', 100)
    if (!variantLabel || !variantValue || /[<>]/.test(variantLabel + variantValue)) redirect(`${fallback}?error=invalid`)
    const originalOption = current.variant_options[0]
    if (variantLabel !== current.variant_label || variantValue !== (originalOption?.value ?? current.variant_label)) {
      input.variant_label = variantLabel
      input.variant_options = [{ axis: current.variant_type, value: variantValue, label: variantLabel }]
    }
  }
  if (Object.keys(input).length === 0) redirect(`${fallback}?saved=unchanged`)

  const hasPriceEdit = ['price', 'sale_price', 'online_discount_amount'].some((field) => field in input)
  if (hasPriceEdit && !staff.capabilities.includes('commerce:write')) redirect(`${fallback}?error=forbidden`)
  if (['pdp_visibility', 'listing_visibility', 'search_visibility'].some((field) => field in input)
    && !staff.capabilities.includes('visibility:write')) redirect(`${fallback}?error=forbidden`)
  if (['seo_indexing', 'sitemap_include'].some((field) => field in input)
    && !staff.capabilities.includes('seo:write')) redirect(`${fallback}?error=forbidden`)
  if (input.publication_status === 'public' && !staff.capabilities.includes('products:publish')) redirect(`${fallback}?error=forbidden`)

  const client = await createAdminServerClient()
  const { error } = await client.schema('public').rpc('phase2_admin_product_update', {
    p_product_id: id,
    p_expected_version: expectedVersion,
    p_input: input,
    p_idempotency_key: idempotencyKey,
    p_request_id: crypto.randomUUID(),
  })
  if (error) {
    const message = error.message || ''
    if (message.includes('STALE_VERSION')) redirect(`${fallback}?error=stale`)
    if (message.includes('INVALID_PRICE')) redirect(`${fallback}?error=price`)
    if (message.includes('UNVERIFIED_PRODUCT_PUBLICATION')) redirect(`${fallback}?error=publication`)
    if (message.includes('VARIANT_GROUP_NOT_VERIFIED') || message.includes('DUPLICATE_VARIANT_OPTION')) redirect(`${fallback}?error=variant`)
    if (message.includes('FORBIDDEN')) redirect(`${fallback}?error=forbidden`)
    redirect(`${fallback}?error=save`)
  }
  revalidatePath('/products')
  revalidatePath(fallback)
  redirect(`${fallback}?saved=1`)
}
