import { describe, expect, it } from 'vitest'
import {
  assertLoopbackDatabaseUrl,
  attributeKey,
  canonicalJson,
  classifyDocumentKind,
  convertNumberToCanonical,
  deterministicChecksum,
  mapExplicitRetailPrice,
  normalizeUnit,
  optionKey,
  slugify,
  stableUuid,
} from './leo562-import-lib'

describe('LEO-562 deterministic mapping primitives', () => {
  it('normalizes slugs, attribute keys, options and stable ids deterministically', () => {
    expect(slugify('Gạch 36GP0814_N')).toBe('gach-36gp0814-n')
    expect(attributeKey('Lượng nước xả', 3)).toBe('legacy_3_luong_nuoc_xa')
    expect(optionKey('Âm tường', 9)).toBe('am_tuong')
    expect(stableUuid('product', '42')).toBe(stableUuid('product', '42'))
    expect(stableUuid('product', '42')).not.toBe(stableUuid('product', '43'))
  })

  it('records legacy price evidence but never promotes it to DPG-owned retail authority', () => {
    expect(mapExplicitRetailPrice({ price: '1200000', price_state: 'priced', price_source: 'hita', price_confidence: 'high' }))
      .toEqual({ retailPrice: null, disposition: 'withheld:legacy-products.price:hita:not-v1-authority' })
    expect(mapExplicitRetailPrice({ price: '1200000', price_state: 'unknown', price_source: 'unknown', price_confidence: 'medium' }).retailPrice)
      .toBeNull()
  })

  it('normalizes supported units and fails closed for unknown units', () => {
    expect(normalizeUnit('cm')).toEqual({ unit: 'mm', dimension: 'length' })
    expect(convertNumberToCanonical(70, 'cm')).toBe(700)
    expect(normalizeUnit('manufacturer-box')).toBeNull()
  })

  it('preserves image/document distinction from explicit type and extension', () => {
    expect(classifyDocumentKind('IMAGE', 'jpg')).toBe('IMAGE')
    expect(classifyDocumentKind('IMAGE', 'pdf')).toBe('DOCUMENT')
    expect(classifyDocumentKind('CAD', 'dwg')).toBe('DOCUMENT')
  })

  it('canonicalizes object key order before checksumming', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }))
    expect(deterministicChecksum({ b: 2, a: 1 })).toBe(deterministicChecksum({ a: 1, b: 2 }))
  })

  it('refuses any non-loopback source or target database', () => {
    expect(() => assertLoopbackDatabaseUrl('postgresql://localhost/source', 'SOURCE')).not.toThrow()
    expect(() => assertLoopbackDatabaseUrl('postgresql://db.example.com/target', 'TARGET')).toThrow('TARGET_MUST_BE_LOOPBACK')
  })
})
