import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { homedir, tmpdir } from 'node:os'
import { Client } from 'pg'
import type { ProductTaxonAssignmentRef } from '../../src/lib/taxonomy-paths'

const taxonomyModule = await import('../../src/lib/taxonomy-paths')
const getCanonicalProductPath = taxonomyModule.getCanonicalProductPath
  ?? (taxonomyModule.default as typeof taxonomyModule).getCanonicalProductPath

const SITE_URL = 'https://www.dongphugia.vn'
const CLOUDFLARE_PAGES_FREE_FILE_LIMIT = 20_000

type Mode = 'production' | 'preview'
type ProductRow = {
  id: number
  slug: string
  name: string
  description: string | null
  seo_title: string | null
  seo_description: string | null
  image_main_url: string | null
  sku: string
  updated_at: Date
  product_type: string | null
  category_slug: string
  category_name: string
  subcategory_slug: string | null
  subcategory_name: string | null
  primary_taxons: Array<{
    slug: string
    name: string
    canonical_path: string
    parent_id: number | null
    is_active: boolean
    is_listing_enabled: boolean
  }>
}

type BlogRow = {
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  updated_at: Date
  published_at: Date | null
  category_slug: string
  category_name: string
}

function parseArgs() {
  const args = new Map<string, string>()
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]
    const value = process.argv[index + 1]
    if (!key?.startsWith('--') || !value) throw new Error(`Invalid argument: ${key ?? ''}`)
    args.set(key.slice(2), value)
  }
  const output = args.get('output')
  const mode = args.get('mode') as Mode | undefined
  if (!output || !path.isAbsolute(output)) throw new Error('--output must be an absolute path')
  const resolvedOutput = path.resolve(output)
  const allowedRoots = [path.resolve(tmpdir()), path.join(homedir(), '.codex', 'tmp')]
  const withinAllowedRoot = allowedRoots.some((root) => {
    const relative = path.relative(root, resolvedOutput)
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  })
  if (!withinAllowedRoot || !path.basename(resolvedOutput).startsWith('leo531-')) {
    throw new Error('--output must be a leo531-* directory inside the system temp or ~/.codex/tmp')
  }
  if (mode !== 'production' && mode !== 'preview') throw new Error('--mode must be production or preview')
  return { output: resolvedOutput, mode, legacySitemapDirectory: args.get('legacy-sitemap-directory') }
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
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function documentHtml(input: {
  mode: Mode
  path: string
  title: string
  description: string
  body: string
  imageUrl?: string | null
  jsonLd?: unknown
  noindex?: boolean
}) {
  const canonical = new URL(input.path, `${SITE_URL}/`).toString()
  const noindex = input.mode === 'preview' || input.noindex === true
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEscape(input.title)}</title>
<meta name="description" content="${htmlEscape(input.description)}">
<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow'}">
<link rel="canonical" href="${htmlEscape(canonical)}">
<meta property="og:url" content="${htmlEscape(canonical)}">${input.imageUrl ? `
<meta property="og:image" content="${htmlEscape(input.imageUrl)}">` : ''}${input.jsonLd ? `
<script type="application/ld+json">${safeJson(input.jsonLd)}</script>` : ''}
</head><body><main>${input.body}</main></body></html>`
}

function containedDestination(output: string, relative: string) {
  if (!relative || path.isAbsolute(relative) || relative.includes('\\')) {
    throw new Error(`Invalid generated path: ${relative}`)
  }
  const destination = path.resolve(output, relative)
  const withinOutput = path.relative(output, destination)
  if (!withinOutput || withinOutput.startsWith('..') || path.isAbsolute(withinOutput)) {
    throw new Error(`Generated path escapes output: ${relative}`)
  }
  return destination
}

async function writeArtifact(output: string, relative: string, content: string, files: Set<string>) {
  if (files.has(relative)) throw new Error(`Duplicate generated file: ${relative}`)
  files.add(relative)
  const destination = containedDestination(output, relative)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, content)
}

async function write(output: string, routePath: string, content: string, files: Set<string>) {
  const segments = routePath.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '..' || segment === '.' || segment.includes('\\'))) {
    throw new Error(`Invalid generated route: ${routePath}`)
  }
  const relative = segments.length === 0 ? 'index.html' : `${segments.join('/')}/index.html`
  await writeArtifact(output, relative, content, files)
}

async function directoryBytes(root: string) {
  let bytes = 0
  const walk = async (directory: string) => {
    const { readdir } = await import('node:fs/promises')
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target)
      else bytes += (await stat(target)).size
    }
  }
  await walk(root)
  return bytes
}

const STATIC_ROUTES = [
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

async function main() {
  const startedAt = performance.now()
  const { output, mode, legacySitemapDirectory } = parseArgs()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')
  const publishingCdnHostname = process.env.PUBLISHING_BUNNY_CDN_HOSTNAME?.trim().toLowerCase()
  if (publishingCdnHostname && !/^[a-z0-9.-]+$/.test(publishingCdnHostname)) {
    throw new Error('PUBLISHING_BUNNY_CDN_HOSTNAME must be an exact hostname')
  }

  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  const files = new Set<string>()
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const products = (await client.query<ProductRow>(`
      SELECT p.id, p.slug, p.name, p.description, p.seo_title, p.seo_description,
             p.image_main_url, p.sku, p.updated_at, p.product_type,
             c.slug AS category_slug, c.name AS category_name,
             s.slug AS subcategory_slug, s.name AS subcategory_name,
             coalesce(tx.primary_taxons, '[]'::json) AS primary_taxons
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'slug', t.slug,
          'name', t.name,
          'canonical_path', t.canonical_path,
          'parent_id', t.parent_id,
          'is_active', t.is_active,
          'is_listing_enabled', t.is_listing_enabled
        ) ORDER BY a.id) AS primary_taxons
        FROM product_taxon_assignments a
        JOIN catalog_taxons t ON t.id = a.taxon_id
        WHERE a.product_id = p.id AND a.is_primary = true
      ) tx ON true
      WHERE p.is_active = true
        AND p.stock_status <> 'discontinued'
        AND p.sellable_status = 'sellable'
        AND p.publication_status = 'public'
        AND p.pdp_visibility = 'public'
        AND p.sitemap_include = true
        AND p.seo_indexing <> 'noindex'
      ORDER BY p.id
    `)).rows

    const subcategories = (await client.query<{
      category_slug: string
      category_name: string
      slug: string
      name: string
      updated_at: Date
    }>(`
      SELECT DISTINCT c.slug AS category_slug, c.name AS category_name,
             s.slug, s.name, s.updated_at
      FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      JOIN products p ON p.subcategory_id = s.id
      WHERE s.is_active = true AND c.is_active = true
        AND p.is_active = true AND p.stock_status <> 'discontinued'
        AND p.sellable_status = 'sellable' AND p.publication_status = 'public'
        AND p.pdp_visibility = 'public' AND p.sitemap_include = true
        AND p.seo_indexing <> 'noindex'
      ORDER BY c.slug, s.slug
    `)).rows

    const blogs = (await client.query<BlogRow>(`
      SELECT p.slug, p.title, p.excerpt, p.cover_image_url, p.updated_at,
             p.published_at, c.slug AS category_slug, c.name AS category_name
      FROM blog_posts p JOIN blog_categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.published_at <= now()
      ORDER BY p.id
    `)).rows

    const categoryRows = (await client.query<{ slug: string; name: string }>(`
      SELECT slug, name FROM categories
      WHERE is_active = true AND slug IN ('thiet-bi-ve-sinh','thiet-bi-bep','gach-op-lat','vat-lieu-nuoc')
      ORDER BY slug
    `)).rows

    for (const [routePath, title] of STATIC_ROUTES) {
      await write(output, routePath, documentHtml({
        mode,
        path: routePath,
        title,
        description: `${title} - Đông Phú Gia`,
        body: `<h1>${htmlEscape(title)}</h1>`,
        jsonLd: routePath === '/' ? {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Đông Phú Gia',
          url: SITE_URL,
        } : undefined,
      }), files)
    }

    for (const category of categoryRows) {
      const routePath = `/${category.slug}`
      await write(output, routePath, documentHtml({
        mode,
        path: routePath,
        title: category.name,
        description: `${category.name} tại Đông Phú Gia`,
        body: `<h1>${htmlEscape(category.name)}</h1><div id="filters" data-runtime="client-api"></div>`,
      }), files)
    }

    for (const subcategory of subcategories) {
      const routePath = `/${subcategory.category_slug}/${subcategory.slug}`
      await write(output, routePath, documentHtml({
        mode,
        path: routePath,
        title: subcategory.name,
        description: `${subcategory.name} - ${subcategory.category_name}`,
        body: `<h1>${htmlEscape(subcategory.name)}</h1><div id="filters" data-runtime="client-api"></div>`,
      }), files)
    }

    const productPaths: string[] = []
    const legacyProductRedirects = new Map<string, string>()
    const mediaHosts = new Set<string>()
    for (const product of products) {
      const assignments: ProductTaxonAssignmentRef[] = product.primary_taxons.map((taxon) => ({
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
      const canonical = getCanonicalProductPath({
        slug: product.slug,
        product_type: product.product_type,
        categories: { slug: product.category_slug, name: product.category_name },
        subcategories: product.subcategory_slug ? {
          slug: product.subcategory_slug,
          name: product.subcategory_name,
        } : null,
        product_taxon_assignments: assignments,
      })
      productPaths.push(canonical.urlPath)
      const legacySubcategory = product.subcategory_slug || product.product_type || (product.category_slug === 'gach-op-lat' ? 'gach-op-lat' : 'all')
      const legacyPath = `/${product.category_slug}/${legacySubcategory}/${product.slug}`
      if (legacyPath !== canonical.urlPath) legacyProductRedirects.set(legacyPath, canonical.urlPath)
      if (product.image_main_url) {
        try { mediaHosts.add(new URL(product.image_main_url).hostname) } catch { /* reported through host count only */ }
      }
      await write(output, canonical.urlPath, documentHtml({
        mode,
        path: canonical.urlPath,
        title: product.seo_title || product.name,
        description: product.seo_description || product.description || product.name,
        imageUrl: product.image_main_url,
        body: `<h1>${htmlEscape(product.name)}</h1>${product.image_main_url ? `<img src="${htmlEscape(product.image_main_url)}" alt="${htmlEscape(product.name)}">` : ''}`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          sku: product.sku,
          url: new URL(canonical.urlPath, `${SITE_URL}/`).toString(),
          image: product.image_main_url ? [product.image_main_url] : [],
        },
      }), files)
    }

    if (legacySitemapDirectory) {
      const legacyBySlug = new Map<string, string>()
      for (const id of [1, 2, 3]) {
        const xml = await readFile(path.join(legacySitemapDirectory, `sitemap_product_${id}.xml`), 'utf8')
        for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
          const legacyPath = new URL(match[1]).pathname
          const slug = legacyPath.split('/').filter(Boolean).at(-1)
          if (!slug) continue
          if (legacyBySlug.has(slug) && legacyBySlug.get(slug) !== legacyPath) {
            throw new Error(`Ambiguous legacy product slug: ${slug}`)
          }
          legacyBySlug.set(slug, legacyPath)
        }
      }
      for (const canonicalPath of productPaths) {
        const slug = canonicalPath.split('/').filter(Boolean).at(-1)
        const legacyPath = slug ? legacyBySlug.get(slug) : undefined
        if (legacyPath && legacyPath !== canonicalPath) legacyProductRedirects.set(legacyPath, canonicalPath)
      }
    }

    await write(output, '/blog', documentHtml({
      mode,
      path: '/blog',
      title: 'Blog',
      description: 'Tin tức và tư vấn từ Đông Phú Gia',
      body: '<h1>Blog</h1><div id="pagination" data-runtime="client-api"></div>',
    }), files)

    const blogCategories = new Map(blogs.map((blog) => [blog.category_slug, blog.category_name]))
    for (const [slug, name] of blogCategories) {
      const routePath = `/blog/${slug}`
      await write(output, routePath, documentHtml({
        mode,
        path: routePath,
        title: name,
        description: `${name} - Đông Phú Gia`,
        body: `<h1>${htmlEscape(name)}</h1><div id="pagination" data-runtime="client-api"></div>`,
      }), files)
    }

    for (const blog of blogs) {
      const routePath = `/blog/${blog.category_slug}/${blog.slug}`
      if (blog.cover_image_url) {
        try { mediaHosts.add(new URL(blog.cover_image_url).hostname) } catch { /* host count only */ }
      }
      await write(output, routePath, documentHtml({
        mode,
        path: routePath,
        title: blog.title,
        description: blog.excerpt || blog.title,
        imageUrl: blog.cover_image_url,
        body: `<article><h1>${htmlEscape(blog.title)}</h1></article>`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: blog.title,
          datePublished: blog.published_at?.toISOString(),
          dateModified: blog.updated_at.toISOString(),
          url: new URL(routePath, `${SITE_URL}/`).toString(),
        },
      }), files)
    }

    for (const routePath of ['/tim-kiem', '/gio-hang', '/dat-hang-thanh-cong']) {
      await write(output, routePath, documentHtml({
        mode,
        path: routePath,
        title: routePath === '/tim-kiem' ? 'Tìm kiếm' : 'Giao dịch',
        description: 'Ứng dụng tương tác Đông Phú Gia',
        body: '<div id="runtime-client-shell"></div>',
        noindex: true,
      }), files)
    }

    const sitemapPageSize = 2_000
    const productSitemapFiles: string[] = []
    for (let offset = 0; offset < productPaths.length; offset += sitemapPageSize) {
      const id = Math.floor(offset / sitemapPageSize) + 1
      const relative = `sitemap_product_${id}.xml`
      productSitemapFiles.push(relative)
      const urls = productPaths.slice(offset, offset + sitemapPageSize)
        .map((url) => `<url><loc>${xmlEscape(new URL(url, `${SITE_URL}/`).toString())}</loc></url>`)
        .join('')
      await writeArtifact(output, relative, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, files)
    }

    const staticSitemapPaths = [
      ...STATIC_ROUTES.map(([routePath]) => routePath),
      ...categoryRows.map((category) => `/${category.slug}`),
      ...subcategories.map((subcategory) => `/${subcategory.category_slug}/${subcategory.slug}`),
      '/blog',
      ...[...blogCategories.keys()].map((slug) => `/blog/${slug}`),
      ...blogs.map((blog) => `/blog/${blog.category_slug}/${blog.slug}`),
    ]
    await writeArtifact(output, 'sitemap_static.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticSitemapPaths.map((url) => `<url><loc>${xmlEscape(new URL(url, `${SITE_URL}/`).toString())}</loc></url>`).join('')}</urlset>`, files)
    await writeArtifact(output, 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE_URL}/sitemap_static.xml</loc></sitemap>${productSitemapFiles.map((file) => `<sitemap><loc>${SITE_URL}/${file}</loc></sitemap>`).join('')}</sitemapindex>`, files)

    const robots = mode === 'preview'
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: ${SITE_URL}/sitemap.xml\n`
    await writeArtifact(output, 'robots.txt', robots, files)
    await writeArtifact(output, '_redirects', [
      '/tin-tuc /blog 301',
      '/tin-tuc/* /blog/:splat 301',
      '/api/sitemap_static /sitemap_static.xml 308',
      ...[...legacyProductRedirects.entries()].map(([source, destination]) => `${source} ${destination} 301`),
      ...productSitemapFiles.map((file) => `/${file} /${file} 200`),
      '',
    ].join('\n'), files)
    const imageSources = new Set([
      'https://cdn.dongphugia.com.vn',
      ...(publishingCdnHostname ? [`https://${publishingCdnHostname}`] : []),
      'https://tygjmrhandbffjllxveu.supabase.co',
      'https://vietceramics.com',
      'https://images.unsplash.com',
      'https://cdn.hita.com.vn',
      'https://hita.com.vn',
      'https://www.transparenttextures.com',
    ])
    const securityHeaders = [
      '  X-Frame-Options: SAMEORIGIN',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
      `  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: ${[...imageSources].join(' ')}; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com; frame-src 'self' https://maps.google.com; upgrade-insecure-requests`,
      '  Strict-Transport-Security: max-age=31536000',
    ]
    await writeArtifact(output, '_headers', [
      '/*',
      ...(mode === 'preview' ? ['  X-Robots-Tag: noindex, nofollow'] : []),
      ...securityHeaders,
      '',
    ].join('\n'), files)

    await client.query('COMMIT')

    const duplicateProductPaths = productPaths.length - new Set(productPaths).size
    if (duplicateProductPaths > 0) throw new Error(`Duplicate product canonical paths: ${duplicateProductPaths}`)
    const outputBytes = await directoryBytes(output)
    const report = {
      mode,
      sourceSnapshot: 'local PostgreSQL restored from read-only Production logical snapshot',
      generatedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      generatedFiles: files.size + 1,
      outputBytes,
      cloudflarePagesFileLimit: CLOUDFLARE_PAGES_FREE_FILE_LIMIT,
      withinCloudflarePagesFileLimit: files.size + 1 <= CLOUDFLARE_PAGES_FREE_FILE_LIMIT,
      routes: {
        products: products.length,
        rootCategories: categoryRows.length,
        subcategories: subcategories.length,
        blogPosts: blogs.length,
        blogCategories: blogCategories.size,
        staticContent: STATIC_ROUTES.length,
        clientRuntimeShells: 3,
      },
      seo: {
        canonicalProductPaths: productPaths.length,
        duplicateProductPaths,
        legacyProductRedirects: legacyProductRedirects.size,
        productSitemapUrls: productPaths.length,
        productSitemapFiles: productSitemapFiles.length,
        staticSitemapUrls: staticSitemapPaths.length,
        robotsMode: mode === 'preview' ? 'disallow-all' : 'allow-public-disallow-admin-api',
        structuredData: ['Organization', 'Product', 'Article'],
      },
      mediaHostnames: [...mediaHosts].sort(),
      dynamicFallbacks: [
        'search query execution',
        'category and subcategory filters/pagination beyond base HTML',
        'blog pagination beyond base HTML',
        'cart/order submission',
      ],
      workerRequired: [
        'apex-to-www redirect',
        'query-string category redirects',
        'maintenance rewrite',
        'API routing',
      ],
    }
    await writeFile(path.join(output, 'proof-report.json'), `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify(report)}\n`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

await main()
