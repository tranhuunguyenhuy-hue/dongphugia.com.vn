import { describe, expect, it } from 'vitest'
import {
  assertSafeDocumentUrl,
  catalogTaxonInputSchema,
  productCanonicalFieldsSchema,
  productSpecValueInputSchema,
} from './pim-validation'

describe('CMS/PIM validation boundaries', () => {
  it('accepts explicit normalized taxon assignment shapes for the action boundary', () => {
    expect(productCanonicalFieldsSchema.safeParse({
      taxon_assignments: [{ taxon_id: 10, is_primary: false }],
    }).success).toBe(true)
    expect(productCanonicalFieldsSchema.safeParse({
      taxon_assignments: [{ taxon_id: 10, is_primary: true }],
    }).success).toBe(true)
  })

  it('accepts taxonomy SEO fields without inferring paths', () => {
    const result = catalogTaxonInputSchema.safeParse({
      name: 'Lavabo',
      slug: 'lavabo',
      canonical_path: 'thiet-bi-ve-sinh/lavabo',
      depth: 1,
      seo_title: 'Lavabo',
      is_indexable: true,
      is_listing_enabled: true,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.canonical_path).toBe('thiet-bi-ve-sinh/lavabo')
  })

  it('rejects non-HTTPS document references and accepts Bunny-compatible HTTPS URLs', () => {
    expect(() => assertSafeDocumentUrl('http://example.com/file.pdf')).toThrow('DOCUMENT_URL_MUST_USE_HTTPS')
    expect(() => assertSafeDocumentUrl('https://cdn.dongphugia.com.vn/products/file.pdf')).not.toThrow()
  })

  it('keeps normalized spec values bounded to a definition and optional option', () => {
    expect(productSpecValueInputSchema.safeParse({
      spec_definition_id: 4,
      option_id: 7,
      value_text: 'Trắng',
    }).success).toBe(true)
    expect(productSpecValueInputSchema.safeParse({ spec_definition_id: 0 }).success).toBe(false)
  })
})
