import { describe, expect, it } from 'vitest'

import { assertNoindexHtml } from './runtime-proof-html.mjs'

const canonicalTitle = 'Đông Phú Gia - Vật liệu xây dựng tại Đà Lạt'
const fixtureTitle = 'Danh mục sản phẩm | Đông Phú Gia Preview'
const adminTitle = 'Dong Phu Gia Admin Application'

function page(title?: string) {
  return `<html><head>${title === undefined ? '' : `<title>${title}</title>`}<meta name="robots" content="noindex, nofollow"></head><body></body></html>`
}

describe('LEO-563 SSR HTML proof title contract', () => {
  it('accepts the canonical Vietnamese Public homepage title', () => {
    expect(() => assertNoindexHtml(page(canonicalTitle), canonicalTitle)).not.toThrow()
  })

  it('accepts the exact local Preview fixture route title', () => {
    expect(() => assertNoindexHtml(page(fixtureTitle), fixtureTitle)).not.toThrow()
  })

  it('retains the exact English Admin title contract', () => {
    expect(() => assertNoindexHtml(page(adminTitle), adminTitle)).not.toThrow()
  })

  it('rejects missing title metadata', () => {
    expect(() => assertNoindexHtml(page(), canonicalTitle)).toThrow(
      'RUNTIME_PROOF_SSR_METADATA_FAILED',
    )
  })

  it('rejects an unrelated or merely similar title', () => {
    expect(() => assertNoindexHtml(page('Dong Phu Gia Admin Application Preview'), canonicalTitle)).toThrow(
      'RUNTIME_PROOF_SSR_METADATA_FAILED',
    )
  })

  it('rejects ambiguous duplicate title tags', () => {
    const duplicate = `${page(canonicalTitle).replace('</head>', `<title>${canonicalTitle}</title></head>`)}`
    expect(() => assertNoindexHtml(duplicate, canonicalTitle)).toThrow(
      'RUNTIME_PROOF_SSR_METADATA_FAILED',
    )
  })
})
