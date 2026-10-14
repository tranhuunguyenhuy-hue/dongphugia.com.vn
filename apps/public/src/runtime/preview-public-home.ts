import type {
  PublicHomeCategory,
  PublicHomePageData,
  PublicHomeProduct,
} from '@dpg/app-contracts'

const productSeed: ReadonlyArray<
  Readonly<{
    name: string
    slug: string
    sku: string
    image: string
    brand: Readonly<{ name: string; slug: string }>
  }>
> = [
  {
    name: 'Bàn cầu một khối cao cấp',
    slug: 'ban-cau-mot-khoi-cao-cap',
    sku: 'DPG-PREVIEW-001',
    image: '/images/assets-v2/thumb-toilet.png',
    brand: { name: 'TOTO', slug: 'toto' },
  },
  {
    name: 'Chậu rửa hiện đại',
    slug: 'chau-rua-hien-dai',
    sku: 'DPG-PREVIEW-002',
    image: '/images/assets-v2/thumb-lavabo.png',
    brand: { name: 'INAX', slug: 'inax' },
  },
  {
    name: 'Vòi sen phòng tắm',
    slug: 'voi-sen-phong-tam',
    sku: 'DPG-PREVIEW-003',
    image: '/images/assets-v2/thumb-shower.png',
    brand: { name: 'Grohe', slug: 'grohe' },
  },
]

function productsFor(
  categorySlug: string,
  subcategorySlug: string,
): readonly PublicHomeProduct[] {
  return productSeed.map((product, index) => ({
    id: Number(`${categorySlug.length}${index + 1}`),
    name: product.name,
    display_name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: 0,
    price_display: 'Liên hệ',
    image_main_url: product.image,
    stock_status: 'in_stock',
    is_active: true,
    is_featured: index === 0,
    is_promotion: false,
    categories: { name: categorySlug, slug: categorySlug },
    subcategories: { name: subcategorySlug, slug: subcategorySlug },
    brands: product.brand,
    url: `/${categorySlug}/${subcategorySlug}/${product.slug}`,
    canonical_category_slug: categorySlug,
    canonical_subcategory_slug: subcategorySlug,
  }))
}

const categories: readonly PublicHomeCategory[] = [
  {
    id: 'thiet-bi-ve-sinh',
    label: 'Thiết Bị Vệ Sinh',
    basePath: '/thiet-bi-ve-sinh',
    products: productsFor('thiet-bi-ve-sinh', 'ban-cau'),
    totalCount: 3,
    availableBrands: [
      { name: 'TOTO', slug: 'toto' },
      { name: 'INAX', slug: 'inax' },
      { name: 'Grohe', slug: 'grohe' },
    ],
    availableSubcategories: [
      { name: 'Bàn cầu', slug: 'ban-cau' },
      { name: 'Lavabo', slug: 'lavabo' },
      { name: 'Sen vòi', slug: 'sen-voi' },
    ],
  },
  {
    id: 'thiet-bi-bep',
    label: 'Thiết Bị Bếp',
    basePath: '/thiet-bi-bep',
    products: productsFor('thiet-bi-bep', 'chau-rua-chen'),
    totalCount: 3,
  },
  {
    id: 'vat-lieu-nuoc',
    label: 'Vật Liệu Nước',
    basePath: '/vat-lieu-nuoc',
    products: productsFor('vat-lieu-nuoc', 'may-bom-nuoc'),
    totalCount: 3,
  },
  {
    id: 'gach-op-lat',
    label: 'Gạch Ốp Lát',
    basePath: '/gach-op-lat',
    products: productsFor('gach-op-lat', 'gach-marble'),
    totalCount: 3,
  },
]

export async function getPublicHomeBanners(): Promise<PublicHomePageData['banners']> {
  // The empty value intentionally exercises the canonical local fallback hero.
  return []
}

export async function getPublicHomeContent(): Promise<
  Pick<PublicHomePageData, 'categories' | 'posts'>
> {
  return {
    categories,
    posts: [
      {
        id: 1,
        title: 'Kinh nghiệm chọn thiết bị vệ sinh cho không gian hiện đại',
        slug: 'kinh-nghiem-chon-thiet-bi-ve-sinh',
        excerpt: 'Nội dung mẫu chỉ dùng để xác thực giao diện Cloudflare Preview.',
        thumbnailUrl: '/images/about-bathroom.jpg',
        publishedAt: '2026-10-15T00:00:00.000Z',
        category: { name: 'Cẩm nang', slug: 'cam-nang' },
      },
      {
        id: 2,
        title: 'Xu hướng vật liệu hoàn thiện cho ngôi nhà mới',
        slug: 'xu-huong-vat-lieu-hoan-thien',
        excerpt: 'Dữ liệu Preview không kết nối và không ghi vào cơ sở dữ liệu Production.',
        thumbnailUrl: '/images/about-interior.jpg',
        publishedAt: '2026-10-14T00:00:00.000Z',
        category: { name: 'Xu hướng', slug: 'xu-huong' },
      },
      {
        id: 3,
        title: 'Tham quan showroom Đông Phú Gia tại Đà Lạt',
        slug: 'tham-quan-showroom-dong-phu-gia',
        excerpt: 'Candidate này dùng cùng component tree với giao diện hiện tại.',
        thumbnailUrl: '/images/about-showroom.jpg',
        publishedAt: '2026-10-13T00:00:00.000Z',
        category: { name: 'Đông Phú Gia', slug: 'dong-phu-gia' },
      },
    ],
  }
}
