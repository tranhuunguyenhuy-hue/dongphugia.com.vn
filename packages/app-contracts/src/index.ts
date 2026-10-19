export const APPLICATION_CONTRACT_VERSION = 'dongphugia:application-foundation:v1'

export const APPLICATIONS = {
  public: {
    name: 'public',
    authority: 'https://www.dongphugia.vn',
    runtime: 'cloudflare-worker-static-assets',
    cachePolicy: 'public-eligible-only',
  },
  admin: {
    name: 'admin',
    authority: 'https://admin.dongphugia.vn',
    runtime: 'independent-private-runtime',
    cachePolicy: 'private-no-store',
  },
} as const

export type ApplicationName = keyof typeof APPLICATIONS

export const PUBLIC_ROUTE_OWNERSHIP = [
  { path: '/', owner: 'public', purpose: 'application-shell' },
  { path: '/[categorySlug]', owner: 'public', purpose: 'catalogue-category' },
  {
    path: '/[categorySlug]/[subcategorySlug]',
    owner: 'public',
    purpose: 'catalogue-listing',
  },
  {
    path: '/[categorySlug]/[subcategorySlug]/[productSlug]',
    owner: 'public',
    purpose: 'catalogue-product',
  },
  { path: '/robots.txt', owner: 'public', purpose: 'crawler-policy' },
  { path: '/api/health', owner: 'public', purpose: 'runtime-probe' },
] as const

export const ADMIN_ROUTE_OWNERSHIP = [
  { path: '/', owner: 'admin', purpose: 'application-shell' },
  { path: '/login', owner: 'admin', purpose: 'staff-auth-shell' },
  { path: '/forgot-password', owner: 'admin', purpose: 'staff-auth-shell' },
  { path: '/reset-password', owner: 'admin', purpose: 'staff-auth-shell' },
  { path: '/auth/callback', owner: 'admin', purpose: 'staff-auth-shell' },
  { path: '/auth/confirm', owner: 'admin', purpose: 'staff-auth-shell' },
  { path: '/auth/logout', owner: 'admin', purpose: 'staff-auth-shell' },
  { path: '/robots.txt', owner: 'admin', purpose: 'crawler-policy' },
  { path: '/api/health', owner: 'admin', purpose: 'runtime-probe' },
] as const

export const PUBLIC_EDGE_CACHE_SECONDS = 300

export const PUBLIC_PREVIEW_NOINDEX = {
  htmlMeta: 'noindex,nofollow',
  responseHeader: 'noindex, nofollow',
  robotsDirective: 'Disallow: /',
} as const

export const ADMIN_PRIVATE_CACHE_CONTROL = 'private, no-store'

export type PublicHomeBanner = Readonly<{
  id: number
  title: string | null
  imageUrl: string
  linkUrl: string | null
  mobileImageUrl?: string | null
  desktopImageUrl?: string | null
  desktopLargeImageUrl?: string | null
}>

export type PublicHomeProduct = Readonly<{
  id: number
  name: string
  slug: string
  sku: string
  price: number | null
  image_main_url: string | null
  [key: string]: unknown
}>

export type PublicHomeCategory = Readonly<{
  id: string
  label: string
  basePath: string
  products: readonly PublicHomeProduct[]
  totalCount: number
  availableBrands?: readonly Readonly<{ name: string; slug: string }>[]
  availableSubcategories?: readonly Readonly<{ name: string; slug: string }>[]
}>

export type PublicHomePost = Readonly<{
  id: number
  title: string
  slug: string
  excerpt: string | null
  thumbnailUrl: string | null
  publishedAt: string
  category: Readonly<{ name: string; slug: string }> | null
}>

export type PublicHomePageData = Readonly<{
  banners: readonly PublicHomeBanner[]
  categories: readonly PublicHomeCategory[]
  posts: readonly PublicHomePost[]
}>

export type PublicContactPayload = Readonly<{
  name: string
  phone: string
  email?: string
  message: string
}>

export type PublicContactResult = Readonly<{
  success: boolean
  error?: string
}>
