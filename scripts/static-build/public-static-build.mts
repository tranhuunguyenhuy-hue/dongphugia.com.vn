import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import { Client } from 'pg'
import type { ProductTaxonAssignmentRef } from '../../src/lib/taxonomy-paths'

const taxonomyImport = await import('../../src/lib/taxonomy-paths.ts')
const taxonomyModule = taxonomyImport as typeof taxonomyImport & {
  default?: typeof taxonomyImport
}
const getCanonicalProductPath = taxonomyModule.getCanonicalProductPath
  ?? taxonomyModule.default?.getCanonicalProductPath
if (!getCanonicalProductPath) throw new Error('STATIC_BUILD_TAXONOMY_IMPORT_FAILED')
const sanitizerImport = await import('../../src/lib/html-sanitizer.ts')
const sanitizerModule = sanitizerImport as typeof sanitizerImport & {
  default?: typeof sanitizerImport
}
const sanitizeRichHtml = sanitizerModule.sanitizeRichHtml ?? sanitizerModule.default?.sanitizeRichHtml
if (!sanitizeRichHtml) throw new Error('STATIC_BUILD_SANITIZER_IMPORT_FAILED')
const preservationImport = await import('../quality/product-family-preservation-contract.ts')
const preservationModule = preservationImport as typeof preservationImport & {
  default?: typeof preservationImport
}
const preservation = preservationModule.assertProductFamilyPreservationContract
  ? preservationModule
  : preservationModule.default
if (!preservation) throw new Error('STATIC_BUILD_PRESERVATION_IMPORT_FAILED')

export const STATIC_SITE_URL = 'https://www.dongphugia.vn'
export const EXPECTED_CANONICAL_PRODUCT_COUNT = 4_033
export const CLOUDFLARE_PAGES_FREE_FILE_LIMIT = 20_000
export const CLOUDFLARE_PAGES_FREE_MAX_FILE_BYTES = 25 * 1024 * 1024
export const ACCEPTED_INVENTORY = { files: 4_093, bytes: 7_559_256 } as const

export const STATIC_CONTENT_ROUTES = [
  ['/', 'Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt'],
  ['/lien-he', 'Liên hệ'],
  ['/ve-chung-toi', 'Về chúng tôi'],
  ['/doi-tac', 'Đối tác'],
  ['/du-an', 'Dự án'],
  ['/chinh-sach-bao-mat', 'Chính sách bảo mật'],
  ['/dich-vu-lap-dat', 'Dịch vụ lắp đặt'],
  ['/dieu-kien-giao-dich', 'Điều kiện giao dịch'],
  ['/dieu-kien-kinh-doanh', 'Điều kiện kinh doanh'],
  ['/thong-tin-gia', 'Thông tin giá'],
  ['/thong-tin-hang-hoa', 'Thông tin hàng hóa'],
  ['/van-chuyen-giao-nhan', 'Vận chuyển và giao nhận'],
] as const

export const CATEGORY_ROOTS = [
  ['thiet-bi-ve-sinh', 'Thiết bị vệ sinh'],
  ['thiet-bi-bep', 'Thiết bị bếp'],
  ['gach-op-lat', 'Gạch ốp lát'],
  ['vat-lieu-nuoc', 'Vật liệu nước'],
] as const

export const CLIENT_RUNTIME_SHELL_ROUTES = ['/tim-kiem', '/gio-hang', '/dat-hang-thanh-cong'] as const
export const PRODUCT_SITEMAP_PAGE_SIZE = 2_000

export type StaticBuildMode = 'production' | 'preview'

export type StaticProduct = {
  id: number
  slug: string
  name: string
  description: string | null
  seo_title: string | null
  seo_description: string | null
  image_main_url: string | null
  sku: string
  updated_at: Date | string
  product_type: string | null
  category_slug: string
  category_name: string
  subcategory_slug: string | null
  subcategory_name: string | null
  stock_status: string
  price: unknown
  original_price: unknown
  list_price: unknown
  sale_price: unknown
  brand_name: string | null
  primary_taxons: Array<{
    slug: string
    name: string
    canonical_path: string
    parent_id: number | null
    is_active: boolean
    is_listing_enabled: boolean
  }>
}

export type StaticSubcategory = {
  category_slug: string
  category_name: string
  slug: string
  name: string
}

export type StaticBlogCategory = { slug: string; name: string }

export type StaticBlogPost = {
  slug: string
  title: string
  excerpt: string | null
  content: string | null
  cover_image_url: string | null
  updated_at: Date | string
  published_at: Date | string | null
  category_slug: string
  category_name: string
}

export type StaticRedirect = { source: string; destination: string; status: number }

export type StaticBuildInput = {
  products: StaticProduct[]
  subcategories: StaticSubcategory[]
  blogCategories?: StaticBlogCategory[]
  blogPosts?: StaticBlogPost[]
  redirects?: StaticRedirect[]
}

export type StaticArtifactInventory = {
  fileCount: number
  totalBytes: number
  largestFile: { path: string; bytes: number }
}

export type StaticBuildOptions = {
  output: string
  mode: StaticBuildMode
  sourceIdentity: string
}

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function xmlEscape(value: string) {
  return htmlEscape(value).replaceAll('&#39;', '&apos;')
}

function safeJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
}

function plainText(value: string | null | undefined, fallback: string) {
  const text = value?.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
  return (text || fallback).slice(0, 160)
}

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

function productAssignments(product: StaticProduct): ProductTaxonAssignmentRef[] {
  return product.primary_taxons.map((taxon) => ({
    is_primary: true,
    catalog_taxons: {
      slug: taxon.slug,
      name: taxon.name,
      canonical_path: taxon.canonical_path,
      parent_id: taxon.parent_id,
      is_active: taxon.is_active,
      is_listing_enabled: taxon.is_listing_enabled,
    },
  }))
}

export function canonicalProductPath(product: StaticProduct) {
  return getCanonicalProductPath({
    slug: product.slug,
    product_type: product.product_type,
    categories: { slug: product.category_slug, name: product.category_name },
    subcategories: product.subcategory_slug
      ? { slug: product.subcategory_slug, name: product.subcategory_name }
      : null,
    product_taxon_assignments: productAssignments(product),
  }).urlPath
}

function productStructuredData(product: StaticProduct, canonicalPath: string) {
  const listPrice = asNumber(product.list_price) ?? asNumber(product.original_price) ?? asNumber(product.price)
  const salePrice = asNumber(product.sale_price)
  const displayPrice = salePrice ?? (asNumber(product.list_price) ? listPrice : null)
  const availability = product.stock_status === 'in_stock'
    ? 'https://schema.org/InStock'
    : product.stock_status === 'pre_order'
      ? 'https://schema.org/PreOrder'
      : null

  if (!availability || displayPrice === null || displayPrice <= 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: plainText(product.description, product.name).slice(0, 500),
    sku: product.sku,
    ...(product.image_main_url ? { image: [product.image_main_url] } : {}),
    ...(product.brand_name ? { brand: { '@type': 'Brand', name: product.brand_name } } : {}),
    url: new URL(canonicalPath, `${STATIC_SITE_URL}/`).toString(),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'VND',
      price: displayPrice,
      availability,
      url: new URL(canonicalPath, `${STATIC_SITE_URL}/`).toString(),
      seller: { '@type': 'Organization', name: 'Đông Phú Gia' },
    },
  }
}

function documentHtml(input: {
  mode: StaticBuildMode
  routePath: string
  title: string
  description: string
  body: string
  jsonLd?: unknown
  imageUrl?: string | null
  noindex?: boolean
}) {
  const canonical = new URL(input.routePath, `${STATIC_SITE_URL}/`).toString()
  const noindex = input.mode === 'preview' || input.noindex === true
  return `<!doctype html>\n<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${htmlEscape(input.title)}</title>\n<meta name="description" content="${htmlEscape(input.description)}">\n<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow'}">\n<link rel="canonical" href="${htmlEscape(canonical)}">\n<meta property="og:url" content="${htmlEscape(canonical)}">${input.imageUrl ? `\n<meta property="og:image" content="${htmlEscape(input.imageUrl)}">` : ''}${input.jsonLd ? `\n<script type="application/ld+json">${safeJson(input.jsonLd)}</script>` : ''}\n</head><body data-static-route="${htmlEscape(input.routePath)}"><main>${input.body}</main></body></html>\n`
}

function outputRelativePath(routePath: string) {
  const segments = routePath.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\'))) {
    throw new Error(`Invalid generated route: ${routePath}`)
  }
  return segments.length === 0 ? 'index.html' : `${segments.join('/')}/index.html`
}

function safeOutputPath(output: string, relativePath: string) {
  const destination = path.resolve(output, relativePath)
  const relative = path.relative(output, destination)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Generated path escapes output: ${relativePath}`)
  }
  return destination
}

function assertSafeOutputDirectory(output: string) {
  const resolvedOutput = path.resolve(output)
  const allowedRoots = [
    path.resolve(process.cwd(), 'scripts/output'),
    path.resolve(tmpdir()),
    path.join(homedir(), '.codex', 'tmp'),
  ]
  const allowed = allowedRoots.some((root) => {
    const relative = path.relative(root, resolvedOutput)
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  })
  if (!allowed) throw new Error('STATIC_BUILD_OUTPUT_FAILED: output must be inside scripts/output, the system temp directory, or ~/.codex/tmp')
}

async function writeUnique(output: string, relativePath: string, content: string, files: Set<string>) {
  if (files.has(relativePath)) throw new Error(`Duplicate generated file: ${relativePath}`)
  files.add(relativePath)
  const destination = safeOutputPath(output, relativePath)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, content)
}

async function writeRoute(output: string, routePath: string, content: string, files: Set<string>) {
  await writeUnique(output, outputRelativePath(routePath), content, files)
}

async function directoryInventory(root: string): Promise<StaticArtifactInventory> {
  const entries: Array<{ path: string; bytes: number }> = []
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target)
      else entries.push({ path: path.relative(root, target), bytes: (await stat(target)).size })
    }
  }
  await walk(root)
  entries.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    largestFile: entries[0] ?? { path: '', bytes: 0 },
  }
}

function productLegacyPath(product: StaticProduct) {
  const subcategory = product.subcategory_slug
    || product.product_type
    || (product.category_slug === 'gach-op-lat' ? 'gach-op-lat' : 'all')
  return `/${product.category_slug}/${subcategory}/${product.slug}`
}

function staticRedirects(input: StaticBuildInput, productPaths: Map<string, string>) {
  const redirects = new Map<string, StaticRedirect>()
  const add = (source: string, destination: string, status: number) => {
    if (source === destination) return
    const existing = redirects.get(source)
    if (existing && (existing.destination !== destination || existing.status !== status)) {
      throw new Error(`Conflicting static redirect for ${source}`)
    }
    redirects.set(source, { source, destination, status })
  }

  add('/tin-tuc', '/blog', 301)
  add('/tin-tuc/*', '/blog/:splat', 301)
  add('/api/sitemap_static', '/sitemap_static.xml', 308)
  for (const redirect of input.redirects ?? []) add(redirect.source, redirect.destination, redirect.status)
  for (const [legacyPath, canonicalPath] of productPaths) add(legacyPath, canonicalPath, 301)
  return [...redirects.values()].sort((a, b) => a.source.localeCompare(b.source))
}

export function validateStaticBuildInput(input: StaticBuildInput) {
  if (input.products.length !== EXPECTED_CANONICAL_PRODUCT_COUNT) {
    throw new Error(`STATIC_BUILD_PRODUCT_COUNT_FAILED: expected ${EXPECTED_CANONICAL_PRODUCT_COUNT}, received ${input.products.length}`)
  }
  const canonicalPaths = input.products.map(canonicalProductPath)
  if (new Set(canonicalPaths).size !== canonicalPaths.length) {
    throw new Error('STATIC_BUILD_CANONICAL_PATH_FAILED: duplicate canonical Product path')
  }
  const categories = new Set(input.products.map((product) => product.category_slug))
  for (const [slug] of CATEGORY_ROOTS) {
    if (!categories.has(slug)) throw new Error(`STATIC_BUILD_CATEGORY_FAILED: missing ${slug}`)
  }
  return canonicalPaths
}

export async function buildStaticArtifact(input: StaticBuildInput, options: StaticBuildOptions) {
  const startedAt = performance.now()
  const output = path.resolve(options.output)
  if (options.mode !== 'production' && options.mode !== 'preview') throw new Error('STATIC_BUILD_MODE_FAILED')
  assertSafeOutputDirectory(output)
  const canonicalPaths = validateStaticBuildInput(input)
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })

  const files = new Set<string>()
  const productPathPairs = new Map<string, string>()
  for (let index = 0; index < input.products.length; index += 1) {
    const product = input.products[index]
    const canonicalPath = canonicalPaths[index]
    const productSchema = productStructuredData(product, canonicalPath)
    productPathPairs.set(productLegacyPath(product), canonicalPath)
    await writeRoute(output, canonicalPath, documentHtml({
      mode: options.mode,
      routePath: canonicalPath,
      title: product.seo_title?.trim() || `${product.name} | ${product.category_name}`,
      description: plainText(product.seo_description || product.description, `${product.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`),
      imageUrl: product.image_main_url,
      jsonLd: [
        ...(productSchema ? [productSchema] : []),
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: STATIC_SITE_URL },
            { '@type': 'ListItem', position: 2, name: product.category_name, item: new URL(`/${product.category_slug}`, `${STATIC_SITE_URL}/`).toString() },
            { '@type': 'ListItem', position: 3, name: product.name, item: new URL(canonicalPath, `${STATIC_SITE_URL}/`).toString() },
          ],
        },
      ],
      body: `<nav aria-label="Breadcrumb"><a href="/">Trang chủ</a> / <a href="/${htmlEscape(product.category_slug)}">${htmlEscape(product.category_name)}</a></nav><h1>${htmlEscape(product.name)}</h1>${product.image_main_url ? `<img src="${htmlEscape(product.image_main_url)}" alt="${htmlEscape(product.name)}">` : ''}`,
    }), files)
  }

  for (const [routePath, title] of STATIC_CONTENT_ROUTES) {
    await writeRoute(output, routePath, documentHtml({
      mode: options.mode,
      routePath,
      title,
      description: `${title} - Đông Phú Gia`,
      jsonLd: routePath === '/' ? { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Đông Phú Gia', url: STATIC_SITE_URL } : undefined,
      body: `<h1>${htmlEscape(title)}</h1>`,
    }), files)
  }

  const categoryNames = new Map(CATEGORY_ROOTS)
  for (const [slug, name] of CATEGORY_ROOTS) {
    await writeRoute(output, `/${slug}`, documentHtml({
      mode: options.mode,
      routePath: `/${slug}`,
      title: name,
      description: `${name} tại Đông Phú Gia`,
      body: `<h1>${htmlEscape(name)}</h1><div data-static-listing="${slug}"></div>`,
    }), files)
  }
  for (const subcategory of input.subcategories) {
    if (!categoryNames.has(subcategory.category_slug)) throw new Error(`STATIC_BUILD_SUBCATEGORY_FAILED: unknown category ${subcategory.category_slug}`)
    const routePath = `/${subcategory.category_slug}/${subcategory.slug}`
    await writeRoute(output, routePath, documentHtml({
      mode: options.mode,
      routePath,
      title: subcategory.name,
      description: `${subcategory.name} - ${subcategory.category_name}`,
      body: `<h1>${htmlEscape(subcategory.name)}</h1><div data-static-listing="${htmlEscape(routePath)}"></div>`,
    }), files)
  }

  const blogCategories = input.blogCategories ?? []
  const blogPosts = input.blogPosts ?? []
  await writeRoute(output, '/blog', documentHtml({
    mode: options.mode,
    routePath: '/blog',
    title: 'Blog',
    description: 'Tin tức và tư vấn từ Đông Phú Gia',
    body: '<h1>Blog</h1><div data-static-blog="index"></div>',
  }), files)
  for (const category of blogCategories) {
    const routePath = `/blog/${category.slug}`
    await writeRoute(output, routePath, documentHtml({
      mode: options.mode,
      routePath,
      title: category.name,
      description: `${category.name} - Đông Phú Gia`,
      body: `<h1>${htmlEscape(category.name)}</h1><div data-static-blog="${htmlEscape(category.slug)}"></div>`,
    }), files)
  }
  for (const post of blogPosts) {
    const routePath = `/blog/${post.category_slug}/${post.slug}`
    await writeRoute(output, routePath, documentHtml({
      mode: options.mode,
      routePath,
      title: post.title,
      description: plainText(post.excerpt || post.content, post.title),
      imageUrl: post.cover_image_url,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: plainText(post.excerpt || post.content, post.title),
        datePublished: post.published_at ? new Date(post.published_at).toISOString() : undefined,
        dateModified: new Date(post.updated_at).toISOString(),
        mainEntityOfPage: new URL(routePath, `${STATIC_SITE_URL}/`).toString(),
      },
      body: `<article><h1>${htmlEscape(post.title)}</h1>${post.content ? `<div>${sanitizeRichHtml(post.content)}</div>` : ''}</article>`,
    }), files)
  }

  for (const routePath of CLIENT_RUNTIME_SHELL_ROUTES) {
    await writeRoute(output, routePath, documentHtml({
      mode: options.mode,
      routePath,
      title: routePath === '/tim-kiem' ? 'Tìm kiếm' : routePath === '/gio-hang' ? 'Giỏ hàng' : 'Đặt hàng thành công',
      description: 'Ứng dụng tương tác Đông Phú Gia',
      noindex: true,
      body: '<div id="runtime-client-shell"></div>',
    }), files)
  }

  const productSitemapFiles: string[] = []
  for (let offset = 0; offset < canonicalPaths.length; offset += PRODUCT_SITEMAP_PAGE_SIZE) {
    const relativePath = `sitemap_product_${Math.floor(offset / PRODUCT_SITEMAP_PAGE_SIZE) + 1}.xml`
    productSitemapFiles.push(relativePath)
    const urls = canonicalPaths.slice(offset, offset + PRODUCT_SITEMAP_PAGE_SIZE)
      .map((routePath) => `<url><loc>${xmlEscape(new URL(routePath, `${STATIC_SITE_URL}/`).toString())}</loc></url>`)
      .join('')
    await writeUnique(output, relativePath, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`, files)
  }

  const staticSitemapPaths = [
    ...STATIC_CONTENT_ROUTES.map(([routePath]) => routePath),
    ...CATEGORY_ROOTS.map(([slug]) => `/${slug}`),
    ...input.subcategories.map((subcategory) => `/${subcategory.category_slug}/${subcategory.slug}`),
    '/blog',
    ...blogCategories.map((category) => `/blog/${category.slug}`),
    ...blogPosts.map((post) => `/blog/${post.category_slug}/${post.slug}`),
  ]
  await writeUnique(output, 'sitemap_static.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticSitemapPaths.map((routePath) => `<url><loc>${xmlEscape(new URL(routePath, `${STATIC_SITE_URL}/`).toString())}</loc></url>`).join('')}</urlset>\n`, files)
  await writeUnique(output, 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${STATIC_SITE_URL}/sitemap_static.xml</loc></sitemap>${productSitemapFiles.map((file) => `<sitemap><loc>${STATIC_SITE_URL}/${file}</loc></sitemap>`).join('')}</sitemapindex>\n`, files)

  const redirects = staticRedirects(input, productPathPairs)
  await writeUnique(output, '_redirects', `${redirects.map((redirect) => `${redirect.source} ${redirect.destination} ${redirect.status}`).join('\n')}\n`, files)
  await writeUnique(output, 'redirects.json', `${JSON.stringify({
    categoryQueryRedirects: CATEGORY_ROOTS.map(([category]) => ({ source: `/${category}?sub=:sub`, destination: `/${category}/:sub`, status: 301 })),
    rules: redirects,
  }, null, 2)}\n`, files)
  const robots = options.mode === 'preview'
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: ${STATIC_SITE_URL}/sitemap.xml\n`
  await writeUnique(output, 'robots.txt', robots, files)
  await writeUnique(output, '_headers', [
    '/*',
    ...(options.mode === 'preview' ? ['  X-Robots-Tag: noindex, nofollow'] : []),
    '  X-Frame-Options: SAMEORIGIN',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
    '  Content-Security-Policy: default-src \'self\'; img-src \'self\' data: blob: https://cdn.dongphugia.com.vn https://cdn.hita.com.vn https://hita.com.vn https://tygjmrhandbffjllxveu.supabase.co https://vietceramics.com https://images.unsplash.com; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'',
    '  Strict-Transport-Security: max-age=31536000',
    '',
  ].join('\n'), files)

  const beforeReport = await directoryInventory(output)
  const report = {
    contract: 'dongphugia:public-static-build:v1',
    sourceIdentity: options.sourceIdentity,
    mode: options.mode,
    generatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startedAt),
    routes: {
      staticContent: STATIC_CONTENT_ROUTES.length,
      categoryRoots: CATEGORY_ROOTS.length,
      subcategories: input.subcategories.length,
      products: input.products.length,
      blogCategories: blogCategories.length,
      blogPosts: blogPosts.length,
      clientRuntimeShells: CLIENT_RUNTIME_SHELL_ROUTES.length,
    },
    seo: {
      canonicalProductPaths: canonicalPaths.length,
      duplicateProductPaths: 0,
      productSitemapFiles: productSitemapFiles.length,
      productSitemapUrls: canonicalPaths.length,
      staticSitemapUrls: staticSitemapPaths.length,
      redirects: redirects.length,
      robots: options.mode === 'preview' ? 'disallow-all' : 'allow-public-disallow-admin-api',
      canonicalBase: STATIC_SITE_URL,
      bunnyMediaPreserved: true,
    },
    inventory: {
      generatedBeforeReport: beforeReport,
      acceptedBaseline: ACCEPTED_INVENTORY,
      providerLimits: { files: CLOUDFLARE_PAGES_FREE_FILE_LIMIT, maxFileBytes: CLOUDFLARE_PAGES_FREE_MAX_FILE_BYTES },
    },
    runtime: {
      usesPrisma: false,
      database: 'build-time read-only source only',
      dynamicResponsibilities: ['search', 'filters', 'pagination', 'cart/order POST', 'API routing', 'apex/query redirects'],
    },
  }
  await writeUnique(output, 'static-build-report.json', `${JSON.stringify(report, null, 2)}\n`, files)
  const inventory = await directoryInventory(output)
  if (inventory.fileCount > CLOUDFLARE_PAGES_FREE_FILE_LIMIT || inventory.largestFile.bytes > CLOUDFLARE_PAGES_FREE_MAX_FILE_BYTES) {
    throw new Error(`STATIC_BUILD_FREE_TIER_FAILED: ${JSON.stringify(inventory)}`)
  }
  if (options.mode === 'preview' && !(await readFile(path.join(output, 'robots.txt'), 'utf8')).includes('Disallow: /')) {
    throw new Error('STATIC_BUILD_PREVIEW_NOINDEX_FAILED: robots')
  }
  return { inventory, productPaths: canonicalPaths, redirects, report }
}

export async function validateStaticArtifact(output: string, productPaths: string[], mode: StaticBuildMode) {
  const resolvedOutput = path.resolve(output)
  const inventory = await directoryInventory(resolvedOutput)
  if (inventory.fileCount > CLOUDFLARE_PAGES_FREE_FILE_LIMIT) throw new Error('STATIC_ARTIFACT_FILE_LIMIT_FAILED')
  if (inventory.largestFile.bytes > CLOUDFLARE_PAGES_FREE_MAX_FILE_BYTES) throw new Error('STATIC_ARTIFACT_MAX_FILE_FAILED')
  for (const file of await listFiles(resolvedOutput)) {
    const content = await readFile(file, 'utf8')
    if (/\bprisma\b/i.test(content)) throw new Error(`STATIC_ARTIFACT_PRISMA_FAILED: ${path.relative(resolvedOutput, file)}`)
  }
  const productSitemaps = (await readdir(resolvedOutput)).filter((file) => /^sitemap_product_\d+\.xml$/.test(file))
  const allSitemapUrls = (await Promise.all(productSitemaps.map(async (file) => (await readFile(path.join(resolvedOutput, file), 'utf8')).match(/<loc>/g)?.length ?? 0))).reduce((a, b) => a + b, 0)
  if (productSitemaps.length === 0 || allSitemapUrls !== productPaths.length) throw new Error('STATIC_ARTIFACT_SITEMAP_FAILED')
  const firstProduct = await readFile(path.join(resolvedOutput, outputRelativePath(productPaths[0])), 'utf8')
  for (const marker of ['rel="canonical"', 'application/ld+json', 'data-static-route']) {
    if (!firstProduct.includes(marker)) throw new Error(`STATIC_ARTIFACT_SEO_FAILED: ${marker}`)
  }
  const robots = await readFile(path.join(resolvedOutput, 'robots.txt'), 'utf8')
  if (mode === 'preview' && !robots.includes('Disallow: /')) throw new Error('STATIC_ARTIFACT_NOINDEX_FAILED')
  if (mode === 'production' && !robots.includes(`Sitemap: ${STATIC_SITE_URL}/sitemap.xml`)) throw new Error('STATIC_ARTIFACT_ROBOTS_FAILED')
  return { inventory, sitemapUrlCount: allSitemapUrls }
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target)
      else files.push(target)
    }
  }
  await walk(root)
  return files
}

function parseCli() {
  const values = new Map<string, string>()
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]
    const value = process.argv[index + 1]
    if (!key?.startsWith('--') || !value) throw new Error(`Invalid argument: ${key ?? ''}`)
    values.set(key.slice(2), value)
  }
  const output = path.resolve(values.get('output') || path.join(process.cwd(), 'scripts/output/public-static-build'))
  const mode = (values.get('mode') || 'production') as StaticBuildMode
  if (mode !== 'production' && mode !== 'preview') throw new Error('--mode must be production or preview')
  return { output, mode }
}

async function readBuildInput(client: Client): Promise<StaticBuildInput> {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  await client.query('SET LOCAL statement_timeout = 150000')
  const products = (await client.query<StaticProduct>(`SELECT p.id, p.slug, p.name, p.description, p.seo_title, p.seo_description,
    p.image_main_url, p.sku, p.updated_at, p.product_type, p.stock_status, p.price, p.original_price,
    p.list_price, p.sale_price, c.slug AS category_slug, c.name AS category_name,
    s.slug AS subcategory_slug, s.name AS subcategory_name, b.name AS brand_name,
    coalesce(tx.primary_taxons, '[]'::json) AS primary_taxons
    FROM products p JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN LATERAL (SELECT json_agg(json_build_object('slug', t.slug, 'name', t.name,
      'canonical_path', t.canonical_path, 'parent_id', t.parent_id, 'is_active', t.is_active,
      'is_listing_enabled', t.is_listing_enabled) ORDER BY a.id) AS primary_taxons
      FROM product_taxon_assignments a JOIN catalog_taxons t ON t.id = a.taxon_id
      WHERE a.product_id = p.id AND a.is_primary = true) tx ON true
    WHERE p.is_active = true AND p.stock_status <> 'discontinued' AND p.sellable_status = 'sellable'
      AND p.publication_status = 'public' AND p.pdp_visibility = 'public'
      AND p.sitemap_include = true AND p.seo_indexing <> 'noindex' ORDER BY p.id`)).rows
  const subcategories = (await client.query<StaticSubcategory>(`SELECT DISTINCT c.slug AS category_slug, c.name AS category_name,
    s.slug, s.name FROM subcategories s JOIN categories c ON c.id = s.category_id
    JOIN products p ON p.subcategory_id = s.id WHERE s.is_active = true AND c.is_active = true
      AND p.is_active = true AND p.stock_status <> 'discontinued' AND p.sellable_status = 'sellable'
      AND p.publication_status = 'public' AND p.pdp_visibility = 'public' AND p.sitemap_include = true
      AND p.seo_indexing <> 'noindex' ORDER BY c.slug, s.slug`)).rows
  const blogPosts = (await client.query<StaticBlogPost>(`SELECT p.slug, p.title, p.excerpt, p.content,
    p.cover_image_url, p.updated_at, p.published_at, c.slug AS category_slug, c.name AS category_name
    FROM blog_posts p JOIN blog_categories c ON c.id = p.category_id
    WHERE p.status = 'published' AND p.published_at <= now() ORDER BY p.id`)).rows
  const blogCategories = [...new Map(blogPosts.map((post) => [post.category_slug, { slug: post.category_slug, name: post.category_name }])).values()]
  const redirects = (await client.query<{ old_url: string; new_url: string; status_code: number | null }>(
    'SELECT old_url, new_url, status_code FROM redirects WHERE is_active = true ORDER BY old_url',
  )).rows.map((redirect) => ({ source: redirect.old_url, destination: redirect.new_url, status: redirect.status_code ?? 301 }))
  await client.query('COMMIT')
  return { products, subcategories, blogCategories, blogPosts, redirects }
}

async function main() {
  const { output, mode } = parseCli()
  if (process.env.PUBLIC_STATIC_BUILD_READ_ONLY !== 'true') throw new Error('PUBLIC_STATIC_BUILD_READ_ONLY=true is required')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const sources = await preservation.loadProductFamilyPreservationSources()
  preservation.assertProductFamilyPreservationContract(sources)
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const input = await readBuildInput(client)
    const result = await buildStaticArtifact(input, { output, mode, sourceIdentity: 'read-only PostgreSQL build snapshot' })
    await validateStaticArtifact(output, result.productPaths, mode)
    process.stdout.write(`${JSON.stringify({ ...result.inventory, canonicalProductCoverage: result.productPaths.length, output, mode })}\n`)
  } finally {
    await client.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
