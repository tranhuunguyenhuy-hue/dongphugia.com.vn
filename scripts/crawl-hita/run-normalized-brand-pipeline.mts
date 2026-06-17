import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const execFileAsync = promisify(execFile)
const prisma = new PrismaClient()
const args = process.argv.slice(2)

const brand = readArg('--brand=', 'viglacera')
const executeImport = args.includes('--execute')
const skipDiscovery = args.includes('--skip-discovery')
const skipCrawl = args.includes('--skip-crawl')
const skipStage = args.includes('--skip-stage')
const skipUpload = args.includes('--skip-upload')
const confirmBrand = readArg('--confirm-brand=', '')
const stopAfter = readArg('--stop-after=', '')
const runDir = readArg('--run-dir=', path.resolve(process.cwd(), `scripts/crawl-hita/output/${brand}/pipeline-${timestampSlug()}`))
const normalizedDir = path.join(runDir, 'normalized')
const preparedDir = path.join(runDir, 'prepared')
const source = readArg('--source=', `hita-normalized-${brand}`.slice(0, 50))
const concurrency = Math.max(1, Math.min(4, Number(readArg('--concurrency=', '2')) || 2))

const brandConfig: Record<string, { brandPageUrl: string; sitemapKeyword: string }> = {
    caesar: { brandPageUrl: 'https://hita.com.vn/thiet-bi-ve-sinh-caesar-383.html', sitemapKeyword: 'caesar' },
    'american-standard': { brandPageUrl: 'https://hita.com.vn/american-standard.html', sitemapKeyword: 'american-standard' },
    cotto: { brandPageUrl: 'https://hita.com.vn/cotto.html', sitemapKeyword: 'cotto' },
    grohe: { brandPageUrl: 'https://hita.com.vn/grohe.html', sitemapKeyword: 'grohe' },
    viglacera: { brandPageUrl: 'https://hita.com.vn/viglacera-597.html', sitemapKeyword: 'viglacera' },
    atmor: { brandPageUrl: 'https://hita.com.vn/atmor.html', sitemapKeyword: 'atmor' },
    moen: { brandPageUrl: 'https://hita.com.vn/moen.html', sitemapKeyword: 'moen' },
}

const config = brandConfig[brand]
if (!config) throw new Error(`Unsupported brand: ${brand}`)
if (executeImport && confirmBrand !== brand) {
    throw new Error(`Import guard failed: pass --confirm-brand=${brand} to execute B5`)
}

const bunnyKey = process.env.BUNNY_STORAGE_API_KEY || ''
const bunnyZone = process.env.BUNNY_STORAGE_ZONE_NAME || ''
const bunnyHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'
const bunnyCdn = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

type DiscoveryReport = {
    brand: string
    generated_at: string
    brand_page_url: string
    sitemap_keyword: string
    sitemap_urls: string[]
    listing_urls: string[]
    merged_urls: string[]
    sitemap_only: string[]
    listing_only: string[]
    expected_listing_count: number | null
    actual_listing_count: number
    listing_delta_pct: number | null
    load_more_clicks: number
}

type DbProduct = {
    id: number
    sku: string
    source_url: string | null
    hita_product_id: string | null
    is_active: boolean
    price: unknown
    original_price: unknown
    online_discount_amount: unknown
    price_display: string | null
    stock_status: string
    specs: unknown
    description: string | null
    image_main_url: string | null
    product_images: Array<{ image_url: string; alt_text: string | null; sort_order: number }>
    product_documents: Array<{ name: string; url: string; source_url: string | null; document_type: string; file_ext: string | null; sort_order: number }>
    product_descriptions: { raw_html: string | null; clean_html: string | null } | null
}

function readArg(prefix: string, fallback: string) {
    const arg = args.find(item => item.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : fallback
}

function timestampSlug() {
    return new Date().toISOString().replace(/[:.]/g, '-')
}

function ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true })
}

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

function writeJson(file: string, value: unknown) {
    ensureDir(path.dirname(file))
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function normalizeUrl(value: string) {
    try {
        const parsed = new URL(value, 'https://hita.com.vn')
        const vid = parsed.searchParams.get('vid')
        parsed.hash = ''
        parsed.search = ''
        return vid ? `${parsed.href}?vid=${encodeURIComponent(vid)}` : parsed.href
    } catch {
        return ''
    }
}

function hitaProductId(url: string | null | undefined) {
    try {
        const parsed = new URL(String(url || ''), 'https://hita.com.vn')
        const vid = parsed.searchParams.get('vid')
        if (vid) return vid
    } catch {
        // Fall through to canonical PDP id extraction.
    }
    return String(url || '').split('?')[0].match(/-(\d+)\.html$/)?.[1] || null
}

function isProductUrl(url: string) {
    const id = hitaProductId(url)
    return url.startsWith('https://hita.com.vn/') && normalizeUrl(url).split('?')[0].endsWith('.html') && Boolean(id && Number(id) >= 1000)
}

function parseRemainingCount(text: string) {
    const match = text.replace(/\s+/g, ' ').match(/xem thêm\s*([\d.]+)\s*sản\s*phẩm/i)
    if (!match) return 0
    return Number(match[1].replace(/\./g, '')) || 0
}

function decimalToNumber(value: unknown) {
    if (value === null || value === undefined) return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toDisplayValue(value: unknown) {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) return value.map(toDisplayValue).filter(Boolean).join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value).trim()
}

function specCount(value: unknown) {
    return Object.keys(asObject(value)).filter(key => !['documents', 'Phụ kiện đi kèm', 'technologies'].includes(key)).length
}

function hasImg(html: string | null | undefined) {
    return /<img\b/i.test(html || '')
}

function isContactPriceDisplay(value: unknown) {
    return /liên hệ|lien he|contact|báo giá|bao gia/i.test(toDisplayValue(value))
}

function extractCandidateUrls(html: string | null | undefined) {
    if (!html) return []
    const urls = new Set<string>()
    const imgRegex = /<img\b[^>]*\b(?:src|data-src)\s*=\s*(["'])(.*?)\1/gi
    let imgMatch: RegExpExecArray | null
    while ((imgMatch = imgRegex.exec(html)) !== null) urls.add(imgMatch[2])
    const urlRegex = /https:\/\/(?:cdn\.hita\.com\.vn\/storage\/products|hita\.com\.vn\/public\/upload|hita\.com\.vn\/tinymce\/uploads)\/[^"'<>)\s]+/gi
    let urlMatch: RegExpExecArray | null
    while ((urlMatch = urlRegex.exec(html)) !== null) urls.add(urlMatch[0])
    return [...urls]
}

function isHitaSource(rawUrl: string) {
    try {
        const url = new URL(rawUrl)
        if (url.hostname === bunnyCdn && url.pathname.startsWith('/migrated/')) return false
        return url.hostname === 'hita.com.vn' || url.hostname === 'cdn.hita.com.vn'
    } catch {
        return false
    }
}

function isWhitelistedDescriptionSource(rawUrl: string) {
    try {
        const url = new URL(rawUrl)
        if (url.hostname === bunnyCdn && url.pathname.startsWith('/migrated/')) return false
        if (url.hostname === 'hita.com.vn' && url.pathname === '/images/icon-pdf.png') return false
        if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/storage/comments/')) return false
        if (url.hostname === 'img.youtube.com') return false
        if (url.hostname === 'cdn.hita.com.vn' && url.pathname.startsWith('/storage/products/')) return true
        if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/public/upload/')) return true
        if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/tinymce/uploads/')) return true
        return false
    } catch {
        return false
    }
}

function destinationFor(rawUrl: string) {
    const url = new URL(rawUrl)
    const hash = crypto.createHash('sha256').update(rawUrl).digest('hex').slice(0, 12)
    const ext = path.extname(decodeURIComponent(url.pathname)).toLowerCase() || '.jpg'
    const base = path.basename(decodeURIComponent(url.pathname), ext)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'image'
    const storagePath = `migrated/${brand}/${hash}-${base}${/^\.(jpe?g|png|gif|webp|avif|svg)$/i.test(ext) ? ext : '.jpg'}`
    return {
        storage_path: storagePath,
        bunny_url: `https://${bunnyCdn}/${storagePath}`,
    }
}

function storageUploadUrl(storagePath: string) {
    return `https://${bunnyHostname}/${bunnyZone}/${storagePath}`
}

async function discoverFromSitemap(page: any) {
    const found = new Set<string>()
    for (let pageNum = 1; pageNum <= 20; pageNum += 1) {
        await page.goto(`https://hita.com.vn/product-sitemap.xml?page=${pageNum}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        const text = await page.locator('pre, body').innerText().catch(() => '')
        for (const match of text.match(/https:\/\/hita\.com\.vn\/[^\s<>]+\.html/g) || []) {
            const url = normalizeUrl(match)
            if (url.toLowerCase().includes(config.sitemapKeyword.toLowerCase()) && isProductUrl(url)) found.add(url)
        }
        await new Promise(resolve => setTimeout(resolve, 350))
    }
    return [...found].sort()
}

async function discoverFromListing(page: any) {
    await page.goto(config.brandPageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const initial = await listingState(page)
    const expected = initial.urls.length + initial.remaining
    let previousCount = initial.urls.length
    let clicks = 0

    for (let i = 0; i < 250; i += 1) {
        const state = await listingState(page)
        const button = page.locator('#category-view-more')
        if (state.remaining <= 0) break
        if ((await button.count()) === 0) break
        await button.click({ timeout: 10_000 }).catch(() => null)
        await page.waitForTimeout(900)
        const after = await listingState(page)
        clicks += 1
        if (after.urls.length <= previousCount) break
        previousCount = after.urls.length
        if (expected && after.urls.length >= expected) break
    }

    const finalState = await listingState(page)
    return {
        urls: finalState.urls,
        expected,
        actual: finalState.urls.length,
        deltaPct: expected ? Math.abs(finalState.urls.length - expected) / expected : null,
        clicks,
    }
}

async function listingState(page: any) {
    return page.evaluate(() => {
        const urls = [...document.querySelectorAll('.product-box-item a.main-link-product[href]')]
            .map((a: Element) => (a as HTMLAnchorElement).href)
            .filter((href: string) => /-\d+\.html$/.test(href))
            .filter((href: string, index: number, all: string[]) => all.indexOf(href) === index)
        const text = document.querySelector('#category-view-more')?.textContent || ''
        return { urls, remainingText: text }
    }).then((state: { urls: string[]; remainingText: string }) => ({
        urls: state.urls.map(normalizeUrl).filter(isProductUrl).sort(),
        remaining: parseRemainingCount(state.remainingText),
    }))
}

async function runDiscovery() {
    const discoveryFile = path.join(runDir, 'discovery.json')
    if (skipDiscovery && fs.existsSync(discoveryFile)) return readJson<DiscoveryReport>(discoveryFile)

    const browser = await chromium.launch({ headless: true })
    try {
        const page = await browser.newPage()
        const sitemapUrls = await discoverFromSitemap(page)
        const listing = await discoverFromListing(page)
        const listingUrls = listing.urls
        const mergedUrls = [...new Set([...sitemapUrls, ...listingUrls])].sort()
        const sitemapSet = new Set(sitemapUrls)
        const listingSet = new Set(listingUrls)
        const report: DiscoveryReport = {
            brand,
            generated_at: new Date().toISOString(),
            brand_page_url: config.brandPageUrl,
            sitemap_keyword: config.sitemapKeyword,
            sitemap_urls: sitemapUrls,
            listing_urls: listingUrls,
            merged_urls: mergedUrls,
            sitemap_only: sitemapUrls.filter(url => !listingSet.has(url)),
            listing_only: listingUrls.filter(url => !sitemapSet.has(url)),
            expected_listing_count: listing.expected,
            actual_listing_count: listing.actual,
            listing_delta_pct: listing.deltaPct,
            load_more_clicks: listing.clicks,
        }
        writeJson(discoveryFile, report)
        if (report.listing_delta_pct !== null && report.listing_delta_pct > 0.02) {
            throw new Error(`B0 discovery gate failed: listing delta ${(report.listing_delta_pct * 100).toFixed(2)}% > 2%`)
        }
        return report
    } finally {
        await browser.close().catch(() => null)
    }
}

async function fetchDbProducts() {
    return prisma.products.findMany({
        where: { brands: { slug: brand } },
        select: {
            id: true,
            sku: true,
            source_url: true,
            hita_product_id: true,
            is_active: true,
            price: true,
            original_price: true,
            online_discount_amount: true,
            price_display: true,
            stock_status: true,
            specs: true,
            description: true,
            image_main_url: true,
            product_images: { select: { image_url: true, alt_text: true, sort_order: true } },
            product_documents: { select: { name: true, url: true, source_url: true, document_type: true, file_ext: true, sort_order: true } },
            product_descriptions: { select: { raw_html: true, clean_html: true } },
        },
    }) as Promise<DbProduct[]>
}

function findDbMatch(product: any, dbProducts: DbProduct[], discoveryUrlSet: Set<string>) {
    const sourceUrl = normalizeUrl(product.source_url || '')
    const id = hitaProductId(sourceUrl)
    return dbProducts.find(row => row.source_url && normalizeUrl(row.source_url) === sourceUrl)
        || dbProducts.find(row => row.hita_product_id && id && String(row.hita_product_id) === id)
        || dbProducts.find(row => row.sku === product.sku)
        || null
}

function prepareProducts(normalizedProducts: any[], rawProducts: any[], discovery: DiscoveryReport, dbProducts: DbProduct[], skipped: Array<{ source_url?: string | null; sku?: string | null; skipped_reason?: string | null }> = []) {
    const discoveryUrlSet = new Set(discovery.merged_urls.map(normalizeUrl))
    const crawledSkuSet = new Set(normalizedProducts.map(product => product.sku).filter(Boolean))
    const crawledUrlSet = new Set(normalizedProducts.map(product => normalizeUrl(product.source_url || '')).filter(Boolean))
    const matched: string[] = []
    const matchedDbIds = new Set<number>()
    const added: string[] = []
    const fieldFlags: Array<{ sku: string; field: string; reason: string }> = []

    const prepared = normalizedProducts.map(product => {
        const next = JSON.parse(JSON.stringify(product))
        const policy: Record<string, string> = {}
        const db = findDbMatch(product, dbProducts, discoveryUrlSet)
        if (db) { matched.push(product.sku); matchedDbIds.add(db.id) }
        else added.push(product.sku)

        if (!db) {
            next.field_policy = { product: 'new_only' }
            return next
        }

        const oldSpecCount = Math.max(specCount(db.specs), 0)
        const newSpecCount = specCount(next.specs)
        if (oldSpecCount > 0 && newSpecCount < oldSpecCount) {
            next.specs = db.specs || {}
            policy.specs = 'preserve_old'
            fieldFlags.push({ sku: next.sku, field: 'specs', reason: `new ${newSpecCount} < old ${oldSpecCount}` })
        }

        const oldGalleryCount = db.product_images.length
        const newGalleryCount = Array.isArray(next.product_images) ? next.product_images.length : 0
        if (oldGalleryCount > 0 && newGalleryCount < oldGalleryCount) {
            next.image_main_url = db.image_main_url
            next.product_images = db.product_images.map(image => ({
                url: image.image_url,
                image_url: image.image_url,
                alt: image.alt_text || next.name,
                sort_order: image.sort_order,
            }))
            policy.gallery = 'preserve_old'
            fieldFlags.push({ sku: next.sku, field: 'gallery', reason: `new ${newGalleryCount} < old ${oldGalleryCount}` })
        }

        const oldDocsCount = db.product_documents.length
        const docs = Array.isArray(next.specs?.documents) ? next.specs.documents : []
        if (oldDocsCount > 0 && docs.length < oldDocsCount) {
            next.specs = {
                ...asObject(next.specs),
                documents: db.product_documents.map(doc => ({
                    name: doc.name,
                    url: doc.url,
                    source_url: doc.source_url || doc.url,
                    type: doc.document_type,
                })),
            }
            policy.documents = 'preserve_old'
            fieldFlags.push({ sku: next.sku, field: 'documents', reason: `new ${docs.length} < old ${oldDocsCount}` })
        }

        const oldHasImg = hasImg(db.description)
        const newHasImg = hasImg(next.description)
        const oldDescLength = (db.description || '').length
        const newDescLength = (next.description || '').length
        if ((oldHasImg && !newHasImg) || (oldDescLength > 500 && newDescLength < oldDescLength * 0.5)) {
            next.description = db.description
            policy.description = 'preserve_old'
            fieldFlags.push({ sku: next.sku, field: 'description', reason: `new desc/img weaker than old` })
        }

        const priceState = toDisplayValue(next.price_state)
        if (priceState === 'discontinued' || toDisplayValue(next.stock_status) === 'discontinued') {
            next.price = null
            next.original_price = null
            next.online_discount_amount = null
            next.price_display = 'Ngừng kinh doanh'
            next.stock_status = 'discontinued'
            policy.price = 'mark_discontinued'
            fieldFlags.push({ sku: next.sku, field: 'price', reason: 'hita marks product discontinued; clear price and set stock_status' })
        } else if (db.price !== null && db.price !== undefined && next.price === null) {
            const noPriceOnHita = priceState === 'no_price_contact' || isContactPriceDisplay(next.price_display)
            if (noPriceOnHita) {
                next.price = null
                next.original_price = null
                next.online_discount_amount = null
                next.price_display = 'Liên hệ báo giá'
                next.stock_status = 'in_stock'
                policy.price = 'clear_contact_price'
                fieldFlags.push({ sku: next.sku, field: 'price', reason: 'hita has no price/contact; clear old price' })
            } else {
                next.price = decimalToNumber(db.price)
                next.original_price = decimalToNumber(db.original_price)
                next.online_discount_amount = decimalToNumber(db.online_discount_amount)
                next.price_display = db.price_display
                policy.price = 'preserve_old'
                fieldFlags.push({ sku: next.sku, field: 'price', reason: 'new price null while old exists and price state is not contact/no-price' })
            }
        }

        if (!next.source_url && db.source_url) {
            next.source_url = db.source_url
            policy.source_url = 'preserve_old'
            fieldFlags.push({ sku: next.sku, field: 'source_url', reason: 'new source_url missing' })
        }

        next.field_policy = Object.keys(policy).length ? policy : { product: 'replace' }
        return next
    })

    const missing = dbProducts
        .filter(row => {
            const sourceUrl = row.source_url ? normalizeUrl(row.source_url) : ''
            const id = row.hita_product_id
            return !crawledSkuSet.has(row.sku)
                && (!sourceUrl || !discoveryUrlSet.has(sourceUrl))
                && (!id || ![...discoveryUrlSet].some(url => hitaProductId(url) === String(id)))
        })
        .map(row => row.sku)

    // [LEO-471 #3] Coverage accounting across ALL discovery URLs + ALL DB rows,
    // not just the kept subset — so "skipped/not-attempted" can never hide.
    // [LEO-471 #3b] Match skipped/discovery by url + hita_product_id + sku,
    // because DB rows may have null/differing source_url (matched via id/sku).
    const skippedByUrl = new Map<string, string>()
    const skippedIdSet = new Set<string>()
    const skippedSkuSet = new Set<string>()
    for (const item of skipped) {
        const url = normalizeUrl(item.source_url || '')
        const reason = item.skipped_reason || 'unknown'
        if (url) {
            skippedByUrl.set(url, reason)
            const id = hitaProductId(url)
            if (id) skippedIdSet.add(id)
        }
        if (item.sku) skippedSkuSet.add(item.sku)
    }
    const discoveryIdSet = new Set<string>()
    for (const url of discoveryUrlSet) {
        const id = hitaProductId(url)
        if (id) discoveryIdSet.add(id)
    }
    const discoveryCoverage = { crawled_kept: 0, not_attempted: 0, skipped: {} as Record<string, number> }
    for (const url of discoveryUrlSet) {
        if (crawledUrlSet.has(url)) discoveryCoverage.crawled_kept++
        else if (skippedByUrl.has(url)) {
            const reason = skippedByUrl.get(url) as string
            discoveryCoverage.skipped[reason] = (discoveryCoverage.skipped[reason] || 0) + 1
        } else discoveryCoverage.not_attempted++
    }
    const dbCoverage = { refreshed: 0, skipped_kept_old: 0, discovered_not_crawled: 0, missing_on_hita: 0 }
    for (const row of dbProducts) {
        const url = row.source_url ? normalizeUrl(row.source_url) : ''
        const id = (url ? hitaProductId(url) : null) || (row.hita_product_id ? String(row.hita_product_id) : null)
        const isSkipped = (!!url && skippedByUrl.has(url)) || (!!id && skippedIdSet.has(id)) || skippedSkuSet.has(row.sku)
        const isDiscovered = (!!url && discoveryUrlSet.has(url)) || (!!id && discoveryIdSet.has(id))
        if (matchedDbIds.has(row.id)) dbCoverage.refreshed++
        else if (isSkipped) dbCoverage.skipped_kept_old++
        else if (isDiscovered) dbCoverage.discovered_not_crawled++
        else dbCoverage.missing_on_hita++
    }

    const reconciliation = {
        hita: discovery.merged_urls.length,
        db: dbProducts.length,
        matched: [...new Set(matched)].length,
        new: [...new Set(added)].length,
        missing: [...new Set(missing)].length,
        coverage: {
            discovery_total: discovery.merged_urls.length,
            discovery: discoveryCoverage,
            db_total: dbProducts.length,
            db: dbCoverage,
        },
        matched_skus: [...new Set(matched)].sort(),
        new_skus: [...new Set(added)].sort(),
        missing_skus: [...new Set(missing)].sort(),
    }

    return { prepared, reconciliation, fieldFlags }
}

function collectImageManifest(products: any[]) {
    const rows: Array<{ sku: string; use: string; source_url: string; bunny_url: string; storage_path: string; upload?: unknown }> = []
    const push = (sku: string, use: string, sourceUrl: string, allowed: (rawUrl: string) => boolean) => {
        if (!sourceUrl || !allowed(sourceUrl)) return
        const destination = destinationFor(sourceUrl)
        rows.push({ sku, use, source_url: sourceUrl, ...destination })
    }
    for (const product of products) {
        push(product.sku, 'image_main_url', product.image_main_url, isHitaSource)
        for (const [index, image] of (product.product_images || []).entries()) {
            push(product.sku, `product_images[${image.sort_order ?? index}]`, image.url || image.image_url, isHitaSource)
        }
        for (const url of extractCandidateUrls(product.description)) {
            push(product.sku, 'description_html', url, isWhitelistedDescriptionSource)
        }
    }
    const deduped = new Map<string, (typeof rows)[number]>()
    for (const row of rows) if (!deduped.has(row.source_url)) deduped.set(row.source_url, row)
    return [...deduped.values()]
}

async function uploadAndVerify(entry: { source_url: string; bunny_url: string; storage_path: string }) {
    if (!bunnyKey || !bunnyZone) return { copied: false, verified: false, status: 0, content_type: null, error: 'missing_bunny_env' }
    try {
        const source = await fetch(entry.source_url)
        if (!source.ok) throw new Error(`source_fetch_${source.status}`)
        const contentType = source.headers.get('content-type') || 'application/octet-stream'
        const buffer = await source.arrayBuffer()
        const upload = await fetch(storageUploadUrl(entry.storage_path), {
            method: 'PUT',
            headers: { AccessKey: bunnyKey, 'Content-Type': contentType },
            body: buffer,
        })
        if (!upload.ok) throw new Error(`bunny_upload_${upload.status}`)
        const head = await fetch(entry.bunny_url, { method: 'HEAD' })
        const verified = head.status === 200 && (head.headers.get('content-type') || '').startsWith('image/')
        return { copied: true, verified, status: head.status, content_type: head.headers.get('content-type'), bunny_url: entry.bunny_url, bytes: buffer.byteLength, error: verified ? null : 'verify_failed' }
    } catch (error) {
        return { copied: false, verified: false, status: 0, content_type: null, error: error instanceof Error ? error.message : String(error) }
    }
}

async function uploadManifest(products: any[]) {
    const manifestFile = path.join(preparedDir, 'image-migration-manifest.json')
    if (skipUpload && fs.existsSync(manifestFile)) return readJson<any>(manifestFile)
    const manifest = collectImageManifest(products)
    for (let index = 0; index < manifest.length; index += concurrency) {
        const batch = manifest.slice(index, index + concurrency)
        await Promise.all(batch.map(async entry => {
            entry.upload = await uploadAndVerify(entry)
        }))
        console.log(`[B4] uploaded ${Math.min(index + concurrency, manifest.length)}/${manifest.length}`)
    }
    const sourceRun = { brand, run_dir: runDir, generated_at: new Date().toISOString() }
    const payload = { sourceRun, manifest }
    writeJson(manifestFile, payload)
    const failed = manifest.filter(entry => !(entry.upload as any)?.verified)
    if (failed.length > 0) throw new Error(`B4 upload gate failed: ${failed.length}/${manifest.length} failed`)
    return payload
}

async function runCommand(command: string, commandArgs: string[]) {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 50,
    })
    if (stderr.trim()) console.error(stderr)
    if (stdout.trim()) console.log(stdout)
    return stdout
}

function parseLastJson(stdout: string) {
    const starts = [...stdout.matchAll(/\{/g)].map(match => match.index || 0).reverse()
    for (const start of starts) {
        try {
            return JSON.parse(stdout.slice(start).trim())
        } catch {
            // Try the next opening brace.
        }
    }
    throw new Error('No JSON object in command output')
}

async function stagePrepared() {
    const stageFile = path.join(runDir, 'stage-result.json')
    if (skipStage && fs.existsSync(stageFile)) return readJson<any>(stageFile)
    const stdout = await runCommand('npx', [
        'tsx',
        'scripts/crawl-hita/stage-sample-crawl.mts',
        `--brand=${brand}`,
        `--source=${source}`,
        `--sample-dir=${preparedDir}`,
        '--execute',
    ])
    const result = parseLastJson(stdout)
    writeJson(stageFile, result)
    return result
}

async function importPrepared(runId: number, requireCount: number) {
    const approvedSkus = await approvedSkusForRun(runId)
    const commonArgs = [
        'tsx',
        'scripts/crawl-hita/import-approved-crawl-snapshots.mts',
        `--brand=${brand}`,
        `--source=${source}`,
        `--run-id=${runId}`,
        `--sample-dir=${preparedDir}`,
        `--image-manifest=${path.join(preparedDir, 'image-migration-manifest.json')}`,
        `--require-count=${requireCount}`,
        `--only-skus=${approvedSkus.join(',')}`,
        '--require-bunny-images',
        '--rewrite-description-images',
    ]
    await runCommand('npx', commonArgs)
    if (!executeImport) return null
    const stdout = await runCommand('npx', [...commonArgs, '--execute'])
    const result = parseLastJson(stdout)
    writeJson(path.join(runDir, 'import-result.json'), result)
    return result
}

async function approvedSkusForRun(runId: number) {
    const decisions = await prisma.crawl_import_decisions.findMany({
        where: {
            decision: 'approved',
            crawl_product_snapshots: { crawl_run_id: runId, source },
        },
        include: {
            crawl_product_snapshots: true,
        },
        orderBy: { id: 'asc' },
    })
    return decisions.map(decision => {
        const payload = asObject(decision.import_payload || decision.crawl_product_snapshots.normalized_payload)
        return toDisplayValue(payload.sku)
    }).filter(Boolean)
}

async function postImportCheck(skus: string[], activeBefore: number) {
    const activeAfter = await prisma.products.count({ where: { brands: { slug: brand }, is_active: true } })
    const rows = await prisma.products.findMany({
        where: { sku: { in: skus } },
        select: {
            sku: true,
            image_main_url: true,
            description: true,
            product_images: { select: { image_url: true } },
            product_descriptions: { select: { raw_html: true } },
        },
    })
    const leftovers = rows.map(row => ({
        sku: row.sku,
        main: /hita\.com\.vn/i.test(row.image_main_url || ''),
        description: /hita\.com\.vn/i.test(row.description || ''),
        gallery: row.product_images.filter(image => /hita\.com\.vn/i.test(image.image_url)).length,
    })).filter(row => row.main || row.description || row.gallery)
    return {
        active_before: activeBefore,
        active_after: activeAfter,
        active_unchanged: activeBefore === activeAfter,
        imported_skus_checked: rows.length,
        hita_leftover_products: leftovers.length,
        hita_leftovers: leftovers.slice(0, 50),
    }
}

function buildMarkdownReport(summary: any) {
    return [
        `# LEO-471 Pipeline Report — ${brand}`,
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## B0 Discovery',
        '',
        `- Hita listing expected: ${summary.discovery.expected_listing_count}`,
        `- Hita listing actual: ${summary.discovery.actual_listing_count}`,
        `- Listing delta: ${summary.discovery.listing_delta_pct === null ? 'n/a' : `${(summary.discovery.listing_delta_pct * 100).toFixed(2)}%`}`,
        `- Sitemap URLs: ${summary.discovery.sitemap_urls.length}`,
        `- Merged URLs: ${summary.discovery.merged_urls.length}`,
        '',
        '## B1 Reconciliation',
        '',
        `Hita: ${summary.reconciliation.hita} | DB: ${summary.reconciliation.db} | Mới: ${summary.reconciliation.new} | Mất: ${summary.reconciliation.missing} | Khớp: ${summary.reconciliation.matched}`,
        '',
        '### Coverage — Discovery (mọi URL hita)',
        `- Crawled & kept: ${summary.reconciliation.coverage?.discovery?.crawled_kept ?? 'n/a'}`,
        `- Skipped (theo lý do): ${JSON.stringify(summary.reconciliation.coverage?.discovery?.skipped ?? {})}`,
        `- Not attempted: ${summary.reconciliation.coverage?.discovery?.not_attempted ?? 'n/a'}`,
        '',
        '### Coverage — DB (mọi sản phẩm đang có)',
        `- Refreshed: ${summary.reconciliation.coverage?.db?.refreshed ?? 'n/a'}`,
        `- Skipped → giữ data cũ: ${summary.reconciliation.coverage?.db?.skipped_kept_old ?? 'n/a'}`,
        `- Discovered nhưng chưa crawl: ${summary.reconciliation.coverage?.db?.discovered_not_crawled ?? 'n/a'}`,
        `- Không còn trên hita: ${summary.reconciliation.coverage?.db?.missing_on_hita ?? 'n/a'}`,
        '',
        '## B3 QA new >= old',
        '',
        `- Products crawled/prepared: ${summary.products}`,
        `- Field downgrade flags: ${summary.field_flags.length}`,
        '',
        '## B4 Bunny',
        '',
        `- Manifest URLs: ${summary.manifest.total}`,
        `- Verified 200/image: ${summary.manifest.verified}/${summary.manifest.total}`,
        '',
        '## B5/B6 Import',
        '',
        summary.import_result ? `- Imported: ${summary.import_result.imported}, failed: ${summary.import_result.failed}` : '- Import: dry-run only, B5 not executed',
        summary.post_import ? `- Active unchanged: ${summary.post_import.active_unchanged} (${summary.post_import.active_before} -> ${summary.post_import.active_after})` : '',
        summary.post_import ? `- Hita leftover products: ${summary.post_import.hita_leftover_products}` : '',
        '',
        '## Artifacts',
        '',
        `- Run dir: \`${runDir}\``,
        `- Discovery: \`${path.join(runDir, 'discovery.json')}\``,
        `- Prepared products: \`${path.join(preparedDir, 'sample-products.normalized.json')}\``,
        `- Manifest: \`${path.join(preparedDir, 'image-migration-manifest.json')}\``,
    ].filter(Boolean).join('\n') + '\n'
}

async function main() {
    ensureDir(runDir)
    ensureDir(normalizedDir)
    ensureDir(preparedDir)

    const discovery = await runDiscovery()
    writeJson(path.resolve(process.cwd(), `scripts/crawl-hita/output/${brand}/urls.json`), discovery.merged_urls)

    if (!skipCrawl) {
        await runCommand('node', [
            'scripts/crawl-hita/0-sample-crawl-brand.js',
            `--brand=${brand}`,
            '--full',
            `--candidate-limit=${discovery.merged_urls.length + 300}`,
            `--concurrency=${concurrency}`,
            `--sample-dir=${normalizedDir}`,
        ])
    }

    const normalizedProducts = readJson<any[]>(path.join(normalizedDir, 'sample-products.normalized.json'))
    const rawProducts = readJson<any[]>(path.join(normalizedDir, 'sample-products.raw.json'))
    const skippedFile = path.join(normalizedDir, 'sample-skipped.json')
    const skipped = fs.existsSync(skippedFile) ? (readJson<any>(skippedFile).items || []) : []
    const dbProducts = await fetchDbProducts()
    const activeBefore = dbProducts.filter(product => product.is_active).length
    const { prepared, reconciliation, fieldFlags } = prepareProducts(normalizedProducts, rawProducts, discovery, dbProducts, skipped)

    fs.copyFileSync(path.join(normalizedDir, 'sample-products.raw.json'), path.join(preparedDir, 'sample-products.raw.json'))
    writeJson(path.join(preparedDir, 'sample-products.normalized.json'), prepared)
    writeJson(path.join(runDir, 'reconciliation.json'), reconciliation)
    writeJson(path.join(runDir, 'field-policy-flags.json'), fieldFlags)

    if (stopAfter === 'prepare') {
        const summary = {
            brand,
            run_dir: runDir,
            source,
            discovery,
            reconciliation,
            products: prepared.length,
            field_flags: fieldFlags,
            stage: null,
            manifest: { total: 0, verified: 0 },
            import_result: null,
            post_import: null,
            stopped_after: 'prepare',
        }
        writeJson(path.join(runDir, 'pipeline-summary.json'), summary)
        fs.writeFileSync(path.join(runDir, 'pipeline-report.md'), buildMarkdownReport(summary))
        console.log(JSON.stringify({
            run_dir: runDir,
            source,
            stopped_after: 'prepare',
            discovery: {
                expected_listing_count: discovery.expected_listing_count,
                actual_listing_count: discovery.actual_listing_count,
                merged_urls: discovery.merged_urls.length,
            },
            reconciliation: {
                hita: reconciliation.hita,
                db: reconciliation.db,
                matched: reconciliation.matched,
                new: reconciliation.new,
                missing: reconciliation.missing,
                coverage: reconciliation.coverage,
            },
            products: prepared.length,
            field_flags: fieldFlags.length,
            stage: null,
            manifest: { total: 0, verified: 0 },
            imported: 0,
            failed: 0,
        }, null, 2))
        return
    }

    const stage = await stagePrepared()
    const manifestPayload = await uploadManifest(prepared)
    const manifest = manifestPayload.manifest || []
    const verified = manifest.filter((entry: any) => entry.upload?.verified).length
    const importResult = await importPrepared(stage.crawl_run_id, stage.summary.approved)
    const postImport = importResult ? await postImportCheck(prepared.map(product => product.sku), activeBefore) : null

    const summary = {
        brand,
        run_dir: runDir,
        source,
        discovery,
        reconciliation,
        products: prepared.length,
        field_flags: fieldFlags,
        stage,
        manifest: { total: manifest.length, verified },
        import_result: importResult,
        post_import: postImport,
    }
    writeJson(path.join(runDir, 'pipeline-summary.json'), summary)
    fs.writeFileSync(path.join(runDir, 'pipeline-report.md'), buildMarkdownReport(summary))
    console.log(JSON.stringify({
        run_dir: runDir,
        source,
        crawl_run_id: stage.crawl_run_id,
        discovery: {
            expected_listing_count: discovery.expected_listing_count,
            actual_listing_count: discovery.actual_listing_count,
            merged_urls: discovery.merged_urls.length,
        },
        reconciliation: {
            hita: reconciliation.hita,
            db: reconciliation.db,
            matched: reconciliation.matched,
            new: reconciliation.new,
            missing: reconciliation.missing,
        },
        products: prepared.length,
        field_flags: fieldFlags.length,
        manifest: { total: manifest.length, verified },
        imported: importResult?.imported ?? 0,
        failed: importResult?.failed ?? 0,
        post_import: postImport,
    }, null, 2))
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
