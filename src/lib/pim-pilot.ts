import { getPrimaryTaxon, type ProductPathInput } from '@/lib/taxonomy-paths'
import { resolveProductCommerce, type ProductCommerceInput } from '@/lib/product-commerce'
import { resolveProductVisibility, type ProductVisibilityInput } from '@/lib/public-product-visibility'

export type PimPilotProduct = ProductPathInput & ProductCommerceInput & ProductVisibilityInput & {
  id: number
  sku: string
  brand_id: number | null
  product_type_id: number | null
  product_sub_type_id: number | null
  document_count: number
  normalized_spec_count: number
}

export type PimPilotDisposition = 'ready' | 'manual_review'

export type PimPilotResult = {
  id: number
  disposition: PimPilotDisposition
  reasons: string[]
}

export function classifyPimPilotProduct(product: PimPilotProduct): PimPilotResult {
  const reasons: string[] = []
  const primary = getPrimaryTaxon(product)
  const commerce = resolveProductCommerce(product)
  const visibility = resolveProductVisibility(product)

  if (!product.brand_id) reasons.push('missing_brand')
  if (!product.product_type_id) reasons.push('missing_product_type')
  if (!product.product_sub_type_id) reasons.push('missing_product_sub_type')
  if (!primary.taxon) reasons.push(primary.exception ?? 'missing_primary_taxon')
  if (commerce.availability === null) reasons.push('unknown_availability')
  if (!visibility.pdp) reasons.push('not_pdp_eligible')
  if (product.normalized_spec_count === 0) reasons.push('missing_normalized_specs')
  if (product.document_count === 0) reasons.push('missing_documents')

  return {
    id: product.id,
    disposition: reasons.length === 0 ? 'ready' : 'manual_review',
    reasons: Array.from(new Set(reasons)),
  }
}

export function buildPimPilotParityReport(products: PimPilotProduct[]) {
  const results = products.map(classifyPimPilotProduct)
  const reasonCounts = new Map<string, number>()
  results.forEach((result) => result.reasons.forEach((reason) => reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)))
  return {
    total: results.length,
    ready: results.filter((result) => result.disposition === 'ready').length,
    manualReview: results.filter((result) => result.disposition === 'manual_review').length,
    reasonCounts: Object.fromEntries(Array.from(reasonCounts.entries()).sort(([a], [b]) => a.localeCompare(b))),
    results,
  }
}
