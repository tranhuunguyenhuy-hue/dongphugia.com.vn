/**
 * crawl_toto_v2.ts — TOTO Crawler v2
 *
 * Improvements over v1:
 *   1. Correct description selector (fixes bad_container bug)
 *   2. Scroll-based lazy image resolution before extraction
 *   3. Per-field update logic (description / accessories / documents independently)
 *   4. PDF migration: download Hita PDF → upload BunnyCDN
 *   5. Expanded accessories keyword list
 *   6. Validation gate (must have >100 chars text content)
 *   7. TEST_MODE flag: runs on 11 representative products first
 */

import { PrismaClient } from '@prisma/client'
import { chromium, Browser, Page } from 'playwright'
import * as cheerio from 'cheerio'
import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()
const prisma = new PrismaClient()

// ─── CONFIG ──────────────────────────────────────────────────────────────────

/** Set to true to run test sample only before full crawl */
const TEST_MODE = process.argv.includes('--test')

/** --subcategory=bon-cau → filter to that subcategory slug */
const SUBCATEGORY_FILTER = (() => {
    const arg = process.argv.find(a => a.startsWith('--subcategory='))
    return arg ? arg.split('=')[1] : null
})()

/** Test sample IDs (general mix) */
const TEST_IDS = [7091, 6539, 6589, 7073, 5704, 6447, 5633, 2764, 6573, 6336, 685]

/** Bon-cau targeted test IDs */
const BON_CAU_TEST_IDS = [676, 677, 678, 679, 680, 681, 682, 683, 684, 685]

const PROGRESS_FILE = path.join(__dirname,
    TEST_MODE ? 'crawl_toto_v2_test_progress.json'
    : SUBCATEGORY_FILTER ? `crawl_toto_v2_${SUBCATEGORY_FILTER}_progress.json`
    : 'crawl_toto_v2_progress.json')

// ─── BUNNY CDN ────────────────────────────────────────────────────────────────

const BUNNY_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME || 'dpg-products'
const BUNNY_KEY = process.env.BUNNY_STORAGE_API_KEY || ''
const BUNNY_STORAGE = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'
const BUNNY_CDN = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

async function uploadToBunny(buffer: Buffer, remotePath: string): Promise<string | null> {
    try {
        const url = `https://${BUNNY_STORAGE}/${BUNNY_ZONE}/${remotePath}`
        await axios.put(url, buffer, {
            headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' }
        })
        return `https://${BUNNY_CDN}/${remotePath}`
    } catch (e: any) {
        console.error(`    ❌ Upload failed: ${e.message}`)
        return null
    }
}

async function downloadAndUpload(srcUrl: string, folder: string, sku: string, ext: string): Promise<string | null> {
    try {
        if (!srcUrl.startsWith('http')) srcUrl = 'https://hita.com.vn' + srcUrl
        // Skip placeholder/base64
        if (srcUrl.includes('data:image') || srcUrl.includes('icon-pdf.png') || srcUrl.includes('placeholder')) return null
        console.log(`    ⬇️  ${srcUrl.slice(0, 70)}`)
        const res = await axios.get(srcUrl, { responseType: 'arraybuffer', timeout: 20000 })
        const buf = Buffer.from(res.data)
        const safeSku = sku.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
        const fileName = `${folder}/${safeSku}_${Date.now()}.${ext}`
        return await uploadToBunny(buf, fileName)
    } catch (e: any) {
        console.error(`    ❌ Download failed (${srcUrl.slice(0, 50)}): ${e.message}`)
        return null
    }
}

// ─── HITA CATEGORY MAP ───────────────────────────────────────────────────────

const HITA_CATEGORY_MAP: Record<string, string> = {
    'bon-cau-thong-minh': 'bon-cau', 'bon-cau-mot-khoi': 'bon-cau',
    'bon-cau-hai-khoi': 'bon-cau', 'bon-cau-treo-tuong': 'bon-cau',
    'bon-cau': 'bon-cau', 'lavabo': 'lavabo', 'lavabo-ban-da': 'lavabo',
    'lavabo-dat-ban': 'lavabo', 'lavabo-treo-tuong': 'lavabo',
    'voi-lavabo': 'voi-chau', 'voi-chau': 'voi-chau',
    'sen-tam': 'sen-tam', 'bon-tam': 'bon-tam', 'bon-tieu': 'bon-tieu',
    'nap-bon-cau': 'nap-bon-cau', 'nap-rua-dien-tu': 'nap-bon-cau',
    'phu-kien-phong-tam': 'phu-kien-phong-tam',
    'voi-bep': 'voi-bep', 'thiet-bi-bep': 'thiet-bi-bep',
}

function extractSkuFromText(text: string): string | null {
    const m = text.match(/\b([A-Z]{1,4}\d{3,}[A-Z0-9#]*)\b/)
    return m ? m[1] : null
}

async function findProductUrlBySku(sku: string): Promise<string | null> {
    try {
        const p = await prisma.products.findFirst({
            where: { sku: { startsWith: sku }, is_combo: false },
            select: { slug: true, subcategories: { select: { slug: true } }, categories: { select: { slug: true } } },
            orderBy: { sku: 'asc' }
        })
        if (p?.slug) {
            const cat = p.categories?.slug || 'thiet-bi-ve-sinh'
            const sub = p.subcategories?.slug || ''
            return `/${cat}/${sub}/${p.slug}`
        }
    } catch { /* ignore */ }
    return null
}

// ─── DESCRIPTION QUALITY CHECKS ──────────────────────────────────────────────

function isBadDescription(desc: string | null): boolean {
    if (!desc) return true
    return (
        /xem th[eê]m|thu g[oọ]n/i.test(desc) ||
        desc.includes('title-common') ||
        desc.includes('description-column-left') ||
        (desc.includes('cdn.hita.com.vn') && !desc.includes('cdn.dongphugia.com.vn')) ||
        desc.includes('data-src=')
    )
}

function hasGoodDescription(desc: string | null): boolean {
    return !!desc && desc.includes('cdn.dongphugia.com.vn') && !isBadDescription(desc)
}

// ─── ACCESSORIES KEYWORDS ─────────────────────────────────────────────────────

// Must EXACTLY match section header — not product feature bullets
const BOX_INCLUDE_KEYWORDS = [
    'nguyên hộp bao gồm',
    'sản phẩm bao gồm',
    'trong hộp sản phẩm',
    'bao gồm trong hộp',
    'combo bao gồm',
    'kèm theo trong hộp',
]

// Patterns for Hita promotional paragraphs — remove from description
const HITA_PROMO_PATTERNS = [
    /nhấn nút mua ngay/i,
    /ship hàng/i,
    /miễn phí giao hàng/i,
    /lắp đặt tận nơi/i,
    /kinh dương vương/i,
    /0\d{2,3}[.\s]?\d{3}[.\s]?\d{3}/,   // phone numbers
    /xem ngay những mẫu/i,
    /top những mẫu/i,
    /tìm hiểu ngay/i,
    /đại lý cấp \d/i,
    /cam kết hàng chính hãng/i,
    /tham khảo trực tiếp tại/i,
    /được lựa chọn nhiều nhất/i,
    /liên hệ để nhận.*tư vấn/i,
    /mức giá (tốt nhất|chiết khấu)/i,
]

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

interface Progress {
    completedIds: number[]
    failedIds: number[]
    stats: {
        descUpdated: number
        accessoriesUpdated: number
        docsUpdated: number
        pdfsMigrated: number
        imgsUploaded: number
    }
    version: string
    lastRunAt: string
}

function loadProgress(): Progress {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
    }
    return {
        completedIds: [], failedIds: [],
        stats: { descUpdated: 0, accessoriesUpdated: 0, docsUpdated: 0, pdfsMigrated: 0, imgsUploaded: 0 },
        version: '2.0',
        lastRunAt: ''
    }
}

function saveProgress(p: Progress) {
    p.lastRunAt = new Date().toISOString()
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

// ─── CORE SCRAPER ─────────────────────────────────────────────────────────────

async function scrapeProduct(page: Page, sku: string, sourceUrl: string) {
    const result = {
        description: null as string | null,
        accessories: [] as string[],
        pdfLinks: [] as { name: string; url: string }[],
        stats: { imgs: 0, pdfs: 0 }
    }

    // STEP 1: Load page, wait for JS render
    await page.goto(sourceUrl, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(2000)

    // Check 404
    const title = await page.title()
    if (title.toLowerCase().includes('404') || title.toLowerCase().includes('error')) {
        console.log(`    ⚠️  404 page detected`)
        return null
    }

    // STEP 2: Scroll to trigger lazy images
    await page.evaluate(async () => {
        await new Promise<void>(resolve => {
            let scrolled = 0
            const step = 300
            const interval = setInterval(() => {
                window.scrollBy(0, step)
                scrolled += step
                if (scrolled >= document.body.scrollHeight) {
                    clearInterval(interval)
                    resolve()
                }
            }, 80)
        })
    })
    await page.waitForTimeout(1500)

    // STEP 3: Resolve all lazy image attributes → real src
    await page.evaluate(() => {
        const lazyAttrs = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy']
        lazyAttrs.forEach(attr => {
            document.querySelectorAll<HTMLImageElement>(`img[${attr}]`).forEach(img => {
                const val = img.getAttribute(attr)
                if (val && !val.startsWith('data:') && !val.includes('placeholder')) {
                    img.src = val
                    img.removeAttribute(attr)
                }
            })
        })
    })

    // STEP 4: Click "Xem thêm" button to expand description
    try {
        await page.evaluate(() => window.scrollTo(0, 0))
        const btn = await page.$('.btn-read-more, .description-show-more, [data-action="show-more"], .show-more-desc')
        if (btn) {
            await btn.click()
            await page.waitForTimeout(1500)
            console.log(`    📖 Expanded description`)
        }
    } catch { /* no button, that's fine */ }

    // STEP 5: Extract description HTML — try selectors in priority order
    const DESC_SELECTORS = [
        '.description-content',            // most specific
        '.description-column-left',        // v2 fix: was missing in v1
        '#tab-desc .tab-pane-content',     // tab-based layout
        '.product-detail-desc',            // alt name
        '.product-description-content',   // another variant
        '#box-description > .card-body',   // card-based layout
    ]

    let rawDescHtml: string | null = null
    for (const sel of DESC_SELECTORS) {
        rawDescHtml = await page.$eval(sel, el => el.innerHTML).catch(() => null)
        if (rawDescHtml && rawDescHtml.trim().length > 100) {
            console.log(`    ✅ Description found via: ${sel}`)
            break
        }
    }

    // STEP 6: Clean & process description
    if (rawDescHtml) {
        const $ = cheerio.load(rawDescHtml)

        // Remove unwanted UI elements FIRST
        $(`.btn-read-more, .description-show-more, .btn-show-more, .read-more,
           .show-more-desc, button, .product-tab-title, .title-header-common.tab,
           #box-package-include, .package-include, .description-attachments,
           .panel-package-include, script, style, noscript`).remove()

        // FIX #2: Remove Hita promotional paragraphs (match whole paragraph text, not partial)
        $('p, li').each((_, el) => {
            const text = $(el).text().trim()
            // Only remove SHORT paragraphs that are purely promotional (< 200 chars)
            if (text.length < 200 && HITA_PROMO_PATTERNS.some(p => p.test(text))) {
                $(el).remove()
            }
        })

        // Process images: upload to BunnyCDN
        const imgs = $('img').toArray()
        for (const img of imgs) {
            const src = $(img).attr('src') || $(img).attr('data-src') || ''
            if (!src || src.includes('cdn.dongphugia.com.vn') || src.startsWith('data:') || src.includes('icon-pdf')) {
                if (src.includes('cdn.dongphugia.com.vn')) {
                    $(img).removeAttr('data-src').removeAttr('class').removeAttr('style')
                } else {
                    $(img).remove()
                }
                continue
            }
            const ext = src.split('.').pop()?.split('?')[0] || 'jpg'
            const cdnUrl = await downloadAndUpload(src, 'description_assets', sku, ext)
            if (cdnUrl) {
                $(img).attr('src', cdnUrl).removeAttr('data-src').removeAttr('class').removeAttr('style').removeAttr('data-lazy-src')
                result.stats.imgs++
            } else {
                $(img).remove()
            }
        }

        // FIX #1: Rewrite links WITHOUT corrupting URLs
        // Only replace text inside <a> nodes, NOT the href attribute itself
        const links = $('a').toArray()
        for (const el of links) {
            const href = $(el).attr('href') || ''
            const text = $(el).text().trim()
            $(el).removeAttr('target').removeAttr('rel')

            // If anchor text is a raw Hita URL → remove entire <a>, keep nothing
            if (/hita\.com\.vn/i.test(text) && text.startsWith('http')) {
                $(el).parent().remove()
                continue
            }

            if (!href.includes('hita.com.vn') && !href.startsWith('/')) continue

            // Strategy 1: link text contains a SKU → resolve to DPG product URL
            const possibleSku = extractSkuFromText(text)
            if (possibleSku) {
                const dpgUrl = await findProductUrlBySku(possibleSku)
                if (dpgUrl) { $(el).attr('href', dpgUrl); continue }
            }

            const slugMatch = href.match(/\/([a-z0-9-]+?)(?:-\d+)?(?:\.html)?$/i)
            if (slugMatch) {
                const mapped = HITA_CATEGORY_MAP[slugMatch[1]]
                $(el).attr('href', mapped ? `/thiet-bi-ve-sinh/${mapped}` : '/thiet-bi-ve-sinh')
            } else {
                $(el).attr('href', '#')
            }
        }

        // Strip empty tags
        $('p, div, span').each((_, el) => {
            if (!$(el).children().length && !$(el).text().trim()) $(el).remove()
        })

        let cleanHtml = $('body').html() || ''
        cleanHtml = cleanHtml.replace(/>([^<]*)<\/[a-z]+>/gi, (match) =>
            match.replace(/\bHita\b/gi, 'Đồng Phú Gia')
        ).trim()

        // Validation gate: must have meaningful content
        const textContent = cheerio.load(cleanHtml).text().trim()
        if (textContent.length > 100) {
            result.description = cleanHtml
        } else {
            console.log(`    ⚠️  Description too short (${textContent.length} chars), skipping`)
        }
    } else {
        console.log(`    ⚠️  No description found with any selector`)
    }

    // STEP 7: Extract Accessories ("Nguyên hộp bao gồm")
    // FIX #3: Look ONLY in dedicated section containers, NOT in description feature/spec lists
    const fullHtml = await page.content()
    const $full = cheerio.load(fullHtml)

    // Priority: known CSS selectors for box-include sections
    const ACC_CONTAINER_SELECTORS = [
        '#box-package-include',
        '.panel-package-include',
        '[class*="package-include"]',
        '[class*="nguyen-hop"]',
        '.section-package',
    ]

    let accFound = false
    for (const sel of ACC_CONTAINER_SELECTORS) {
        const container = $full(sel)
        if (!container.length) continue
        container.find('li').each((_, li) => {
            const item = $full(li).text().replace(/^[-•*]\s*/, '').trim()
            if (item.length > 2 && !result.accessories.includes(item)) result.accessories.push(item)
        })
        if (result.accessories.length === 0) {
            container.find('p').each((_, p) => {
                const html = $full(p).html() || ''
                html.split(/<br\s*\/?>/i).forEach(part => {
                    const clean = cheerio.load(part).text().replace(/^[-•]\s*/, '').trim()
                    if (clean.length > 2 && !result.accessories.includes(clean)) result.accessories.push(clean)
                })
            })
        }
        if (result.accessories.length > 0) { accFound = true; break }
    }

    // Fallback: find by header text — but EXCLUDE description area
    if (!accFound) {
        $full('h3, h4, .title-common span, .panel-heading span, strong').each((_, el) => {
            const elText = $full(el).text().trim().toLowerCase()
            if (!BOX_INCLUDE_KEYWORDS.some(kw => elText === kw)) return
            // Must NOT be inside description tab
            if ($full(el).closest('#tab-desc, .description-content, .description-collapse').length) return
            const panelBody = $full(el).closest('.panel, .card').find('.panel-body, ul, ol').first()
            panelBody.find('li').each((_, li) => {
                const item = $full(li).text().replace(/^[-•*]\s*/, '').trim()
                if (item.length > 2 && !result.accessories.includes(item)) result.accessories.push(item)
            })
        })
    }

    // STEP 8: Extract PDF documents (navigate to documents tab)
    try {
        const tabs = await page.$$('.nav-tabs li, .product-tab .nav-item, .product-detail-tab a')
        for (const tab of tabs) {
            const tabText = await tab.innerText().catch(() => '')
            if (tabText.includes('Tài liệu') || tabText.includes('Download')) {
                await tab.click()
                await page.waitForTimeout(1200)
                break
            }
        }
    } catch { /* no tabs */ }

    const docHtml = await page.content()
    const $doc = cheerio.load(docHtml)
    $doc('a[href$=".pdf"]').each((_, el) => {
        const href = $doc(el).attr('href') || ''
        if (!href) return
        let label = $doc(el).text().trim()
            || $doc(el).closest('li').text().trim()
            || 'Tài liệu PDF'
        label = label.replace(/xem|tải về|download/gi, '').trim() || 'Tài liệu PDF'
        const fullUrl = href.startsWith('http') ? href : `https://hita.com.vn${href}`
        if (!result.pdfLinks.find(p => p.url === fullUrl)) {
            result.pdfLinks.push({ name: label, url: fullUrl })
        }
    })

    // STEP 9: Migrate PDFs to BunnyCDN
    const migratedDocs: { name: string; url: string }[] = []
    for (const doc of result.pdfLinks) {
        if (doc.url.includes('cdn.dongphugia.com.vn')) {
            migratedDocs.push(doc) // Already migrated
            continue
        }
        const cdnUrl = await downloadAndUpload(doc.url, 'product_docs', sku, 'pdf')
        if (cdnUrl) {
            migratedDocs.push({ name: doc.name, url: cdnUrl })
            result.stats.pdfs++
        } else {
            migratedDocs.push(doc) // Keep original if upload fails
        }
    }
    result.pdfLinks = migratedDocs

    return result
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
    console.log(`\n${'='.repeat(60)}`)
    console.log(TEST_MODE ? '🧪 TEST MODE — crawling 11 sample products' : '🚀 FULL MODE — crawling all 1,882 TOTO products')
    console.log(`${'='.repeat(60)}\n`)

    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    if (!brand) { console.error('TOTO brand not found'); return }

    // Get products
    const testIds = process.argv.includes('--bon-cau') ? BON_CAU_TEST_IDS : TEST_IDS
    const allProducts = await prisma.products.findMany({
        where: {
            brand_id: brand.id,
            is_active: true,
            source_url: { not: null },
            ...(TEST_MODE || process.argv.includes('--bon-cau') ? { id: { in: testIds } } : {}),
            ...(SUBCATEGORY_FILTER ? { subcategories: { slug: SUBCATEGORY_FILTER } } : {}),
        },
        select: { id: true, sku: true, description: true, specs: true, source_url: true },
        orderBy: { id: 'asc' }
    })

    const progress = loadProgress()
    const pending = allProducts.filter(p =>
        !progress.completedIds.includes(p.id) && !progress.failedIds.includes(p.id)
    )

    console.log(`📊 Status: ${allProducts.length} total | ${progress.completedIds.length} done | ${pending.length} pending`)
    if (!pending.length) { console.log('🎉 All done!'); return }

    let browser: Browser = await chromium.launch({ headless: true })
    let context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    let page = await context.newPage()

    let count = 0
    for (const product of pending) {
        count++
        const needsDesc = isBadDescription(product.description)
        const hasGoodDesc = hasGoodDescription(product.description)

        console.log(`\n[${ count }/${ pending.length }] SKU: ${ product.sku.slice(0, 35) } (ID: ${ product.id })`)
        console.log(`    Desc state: ${ needsDesc ? '🔴 bad/missing' : hasGoodDesc ? '✅ good' : '🟡 unknown' }`)

        try {
            const data = await scrapeProduct(page, product.sku, product.source_url!)

            if (!data) {
                progress.failedIds.push(product.id)
                saveProgress(progress)
                continue
            }

            // Build DB update payload
            const specs = (typeof product.specs === 'object' && product.specs)
                ? { ...(product.specs as object) }
                : {} as any

            const updatePayload: any = {}

            // Description: only update if current is bad
            if (needsDesc && data.description) {
                updatePayload.description = data.description
                progress.stats.descUpdated++
                console.log(`    ✅ Description: updated (${data.stats.imgs} imgs uploaded)`)
            } else if (hasGoodDesc) {
                console.log(`    ⏭️  Description: kept (already good)`)
            } else {
                console.log(`    ⚠️  Description: no valid content extracted`)
            }

            // Accessories: always update if found
            if (data.accessories.length > 0) {
                specs['Phụ kiện đi kèm'] = data.accessories
                progress.stats.accessoriesUpdated++
                console.log(`    ✅ Accessories: ${data.accessories.length} items`)
            }

            // Documents: always update with migrated URLs
            if (data.pdfLinks.length > 0) {
                specs['documents'] = data.pdfLinks
                delete specs['Bản vẽ kỹ thuật (PDF)']
                progress.stats.docsUpdated++
                progress.stats.pdfsMigrated += data.stats.pdfs
                console.log(`    ✅ Docs: ${data.pdfLinks.length} PDFs (${data.stats.pdfs} migrated to CDN)`)
            }

            // Write to DB
            await prisma.products.update({
                where: { id: product.id },
                data: {
                    ...(updatePayload.description !== undefined ? { description: updatePayload.description } : {}),
                    specs: specs as any
                }
            })

            progress.completedIds.push(product.id)
            saveProgress(progress)

        } catch (err: any) {
            console.error(`    ❌ Crash: ${err.message}`)
            progress.failedIds.push(product.id)
            saveProgress(progress)

            // Restart browser on crash
            try { await browser.close() } catch { /* ignore */ }
            await delay(2000)
            browser = await chromium.launch({ headless: true })
            context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            page = await context.newPage()
        }

        // Rate limiting: 3-6s random
        const wait = Math.floor(Math.random() * 3000) + 3000
        await delay(wait)
    }

    await browser.close()

    console.log(`\n${'='.repeat(60)}`)
    console.log(TEST_MODE ? '🧪 TEST COMPLETE — Review results above' : '🎉 FULL CRAWL COMPLETE')
    console.log(`Stats: desc=${progress.stats.descUpdated} | acc=${progress.stats.accessoriesUpdated} | docs=${progress.stats.docsUpdated} | pdfs_migrated=${progress.stats.pdfsMigrated}`)
    console.log(`${'='.repeat(60)}\n`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
