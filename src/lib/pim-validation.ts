import { z } from 'zod'

const optionalUrl = z.string().url().max(1000).optional().nullable().or(z.literal(''))

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  logo_url: optionalUrl,
  description: z.string().max(10_000).optional().nullable(),
  origin_country: z.string().max(100).optional().nullable(),
  website_url: optionalUrl,
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
})

export const catalogTaxonInputSchema = z.object({
  parent_id: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  canonical_path: z.string().trim().min(1).max(500),
  depth: z.coerce.number().int().min(0).max(10),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
  kind: z.string().trim().min(1).max(40).default('type'),
  status: z.string().trim().min(1).max(40).default('active'),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  is_indexable: z.boolean().default(true),
  is_listing_enabled: z.boolean().default(true),
})

export const productTypeInputSchema = z.object({
  subcategory_id: z.coerce.number().int().positive(),
  slug: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
  filter_policy: z.record(z.string(), z.unknown()).default({}),
})

export const productSubTypeInputSchema = z.object({
  product_type_id: z.coerce.number().int().positive(),
  slug: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
})

export const specDefinitionInputSchema = z.object({
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(200),
  data_type: z.string().trim().min(1).max(30).default('text'),
  unit: z.string().max(30).optional().nullable(),
  is_filterable: z.boolean().default(false),
  is_pdp_visible: z.boolean().default(true),
  is_reserved: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
  normalize_rule: z.record(z.string(), z.unknown()).default({}),
})

export const specOptionInputSchema = z.object({
  spec_definition_id: z.coerce.number().int().positive(),
  value: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(160),
  sort_order: z.coerce.number().int().default(0),
  aliases: z.array(z.string().trim().min(1).max(200)).default([]),
  is_active: z.boolean().default(true),
})

export const productSpecValueInputSchema = z.object({
  spec_definition_id: z.coerce.number().int().positive(),
  option_id: z.coerce.number().int().positive().optional().nullable(),
  value_text: z.string().max(500).optional().nullable(),
  value_number: z.coerce.number().finite().optional().nullable(),
  value_json: z.unknown().optional().nullable(),
  raw_key: z.string().max(200).optional().nullable(),
  raw_value: z.string().max(10_000).optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
})

export const productDocumentInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().url().max(1000),
  source_url: optionalUrl,
  document_type: z.string().trim().min(1).max(30).default('DOCUMENT'),
  file_ext: z.string().max(20).optional().nullable(),
  file_size: z.coerce.number().int().nonnegative().optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
})

export const productTaxonAssignmentSchema = z.object({
  taxon_id: z.coerce.number().int().positive(),
  is_primary: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
})

export const productCanonicalFieldsSchema = z.object({
  brand_id: z.coerce.number().int().positive().optional().nullable(),
  product_type_id: z.coerce.number().int().positive().optional().nullable(),
  product_sub_type_id: z.coerce.number().int().positive().optional().nullable(),
  taxon_assignments: z.array(productTaxonAssignmentSchema).max(20).optional(),
})

export function assertSafeDocumentUrl(rawUrl: string) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') {
    throw new Error('DOCUMENT_URL_MUST_USE_HTTPS')
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    throw new Error('DOCUMENT_URL_HOST_NOT_ALLOWED')
  }
}

export type BrandInput = z.infer<typeof brandInputSchema>
export type CatalogTaxonInput = z.infer<typeof catalogTaxonInputSchema>
export type ProductTypeInput = z.infer<typeof productTypeInputSchema>
export type ProductSubTypeInput = z.infer<typeof productSubTypeInputSchema>
export type SpecDefinitionInput = z.infer<typeof specDefinitionInputSchema>
export type SpecOptionInput = z.infer<typeof specOptionInputSchema>
export type ProductDocumentInput = z.infer<typeof productDocumentInputSchema>
