import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  getPublicHomeBanners,
  getPublicHomeContent,
} from './runtime/preview-public-home'
import { submitContactForm } from './runtime/preview-public-interactions'

const repositoryRoot = resolve(import.meta.dirname, '../../..')

describe('Cloudflare canonical Public UI adapter', () => {
  it('renders the canonical page and layout through runtime adapters', () => {
    const page = readFileSync(resolve(repositoryRoot, 'apps/public/app/page.tsx'), 'utf8')
    const layout = readFileSync(resolve(repositoryRoot, 'apps/public/app/layout.tsx'), 'utf8')
    const canonicalPage = readFileSync(resolve(repositoryRoot, 'src/app/(public)/page.tsx'), 'utf8')

    expect(page).toContain("from '@/app/(public)/page'")
    expect(page).toContain('export { default }')
    expect(page).not.toContain('EmergencyPublicHomePage')
    expect(layout).toContain("from '@/app/(public)/layout'")
    expect(layout).not.toContain('emergencyShell')
    expect(canonicalPage).toContain("from \"@dpg/public-home-runtime\"")
    expect(canonicalPage).not.toMatch(/lib\/(?:prisma|homepage-data|public-api-products)/)
  })

  it('keeps canonical About and read-only Contact pages reachable in Preview', () => {
    const aboutRoute = readFileSync(resolve(repositoryRoot, 'apps/public/app/ve-chung-toi/page.tsx'), 'utf8')
    const contactRoute = readFileSync(resolve(repositoryRoot, 'apps/public/app/lien-he/page.tsx'), 'utf8')
    const contactComponent = readFileSync(resolve(repositoryRoot, 'src/app/(public)/lien-he/contact-form.tsx'), 'utf8')

    expect(aboutRoute).toContain("AboutClient")
    expect(contactRoute).toContain('ContactForm readOnly')
    expect(contactComponent).toContain('@dpg/public-interactions')
  })

  it('renders category structure without any invented catalogue or Blog content', async () => {
    const [banners, data] = await Promise.all([
      getPublicHomeBanners(),
      getPublicHomeContent(),
    ])

    expect(banners).toHaveLength(1)
    expect(banners[0]).toMatchObject({ imageUrl: '/images/banner-3.jpg', linkUrl: null })

    expect(data.categories.map((category) => category.id)).toEqual([
      'thiet-bi-ve-sinh',
      'thiet-bi-bep',
      'gach-op-lat',
      'vat-lieu-nuoc',
    ])
    expect(data.categories.every((category) => category.products.length === 0 && category.totalCount === 0)).toBe(true)
    expect(data.previewNotice).toMatch(/chưa hiển thị sản phẩm, giá hoặc tình trạng hàng đã xác minh/i)
    expect(data.posts).toEqual([])
    expect(() => JSON.stringify({ banners, ...data })).not.toThrow()
  })

  it('fails closed for Preview contact writes', async () => {
    await expect(submitContactForm({
      name: 'Preview User',
      phone: '0900000000',
      message: 'Preview only',
    })).resolves.toEqual({
      success: false,
      error: 'Biểu mẫu đang tạm khóa trên bản Preview và không ghi dữ liệu.',
    })
  })
})
