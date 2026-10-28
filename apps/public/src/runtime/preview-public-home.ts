import type { PublicHomeCategory, PublicHomeContent, PublicHomePageData } from '@dpg/app-contracts'
import { NAV_PRODUCT_CATEGORIES } from '@/config/site'

export async function getPublicHomeBanners(): Promise<PublicHomePageData['banners']> {
  // This existing editorial scene has no embedded SKU, price, or inventory claim.
  // Keep the canonical HeroBanner component, without using its commerce banner fallback.
  return [{
    id: 1,
    title: 'Không gian nội thất minh họa',
    imageUrl: '/images/banner-3.jpg',
    linkUrl: null,
    mobileImageUrl: '/images/banner-3.jpg',
    desktopImageUrl: '/images/banner-3.jpg',
    desktopLargeImageUrl: '/images/banner-3.jpg',
  }]
}

export async function getPublicHomeContent(): Promise<PublicHomeContent> {
  const categories: readonly PublicHomeCategory[] = NAV_PRODUCT_CATEGORIES
    .filter(({ active }) => active)
    .map(({ href, label }) => ({
      id: href.slice(1),
      label,
      basePath: href,
      products: [],
      totalCount: 0,
    }))

  return {
    categories,
    posts: [],
    previewNotice: 'Danh mục trực tuyến đang được cập nhật. Website hiện chưa hiển thị sản phẩm, giá hoặc tình trạng hàng đã xác minh; vui lòng liên hệ trực tiếp để được tư vấn.',
  }
}
