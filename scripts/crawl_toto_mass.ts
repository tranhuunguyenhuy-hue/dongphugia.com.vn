import { PrismaClient } from '@prisma/client'
import { chromium, Page } from 'playwright'
import * as cheerio from 'cheerio'
import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()
const prisma = new PrismaClient()

// ---- HITA → DPG slug mapping ----
const HITA_CATEGORY_MAP: Record<string, string> = {
    'bon-cau-thong-minh': 'bon-cau', 'bon-cau-mot-khoi': 'bon-cau',
    'bon-cau-hai-khoi': 'bon-cau', 'bon-cau-treo-tuong': 'bon-cau',
    'lavabo': 'lavabo', 'lavabo-ban-da': 'lavabo', 'lavabo-dat-ban': 'lavabo',
    'lavabo-treo-tuong': 'lavabo', 'voi-lavabo': 'voi-chau', 'voi-chau': 'voi-chau',
    'sen-tam': 'sen-tam', 'bon-tam': 'bon-tam', 'bon-tieu': 'bon-tieu',
    'nap-bon-cau': 'nap-bon-cau', 'nap-rua-dien-tu': 'nap-bon-cau',
    'phu-kien-phong-tam': 'phu-kien-phong-tam',
}

function extractSkuFromText(text: string): string | null {
    const match = text.match(/\b([A-Z]{1,4}\d{3,}[A-Z0-9]*(?:#[A-Z0-9]+)?)\b/)
    return match ? match[1] : null
}

async function findProductUrlBySku(sku: string): Promise<string | null> {
    try {
        const product = await prisma.products.findFirst({
            where: { sku: { startsWith: sku }, is_combo: false },
            select: { slug: true, subcategories: { select: { slug: true } }, categories: { select: { slug: true } } },
            orderBy: { sku: 'asc' }
        })
        if (product?.slug) {
            const catSlug = product.categories?.slug || 'thiet-bi-ve-sinh'
            const subSlug = product.subcategories?.slug || ''
            return `/${catSlug}/${subSlug}/${product.slug}`
        }
    } catch (e) { /* ignore */ }
    return null
}

// Bunny CDN Config
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME || 'dpg-products'
const BUNNY_API_KEY = process.env.BUNNY_STORAGE_API_KEY || ''
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'
const BUNNY_CDN_HOST = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

const PROGRESS_FILE = path.join(__dirname, 'crawl_toto_progress.json')

function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
    }
    return { completedIds: [], failedIds: [] }
}

function saveProgress(progress: any) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function uploadToBunny(imageUrl: string, sku: string): Promise<string | null> {
    try {
        if (!imageUrl.startsWith('http')) {
            imageUrl = 'https://hita.com.vn' + imageUrl
        }
        console.log(`  ⬇️  Downloading image: ${imageUrl.substring(0, 60)}...`)
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
        const buffer = Buffer.from(response.data)

        const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg'
        const fileName = `desc_${sku.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`
        const filePath = `description_assets/${fileName}`

        const uploadUrl = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filePath}`
        
        await axios.put(uploadUrl, buffer, {
            headers: {
                'AccessKey': BUNNY_API_KEY,
                'Content-Type': 'application/octet-stream'
            }
        })
        
        return `https://${BUNNY_CDN_HOST}/${filePath}`
    } catch (error: any) {
        console.error(`  ❌ Failed to upload ${imageUrl}: ${error.message}`)
        return null
    }
}

async function scrapeHitaProduct(page: Page, sku: string, sourceUrl: string | null) {
    if (!sourceUrl || !sourceUrl.includes('hita.com.vn')) {
        console.log(`  ❌ SKU ${sku} has no valid Hita source URL.`)
        return null
    }

    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1000)

    // Click "Xem thêm" in description
    try {
        const xemThem = await page.$('.description-show-more, .btn-show-more')
        if (xemThem) {
            await xemThem.click()
            await page.waitForTimeout(1000)
        }
    } catch (e) {}

    const result: any = {
        descriptionCleanHtml: '',
        accessories: [],
        pdfLinks: []
    }

    // Process Description
    const descHtml = await page.$eval('.description-content, #box-description, .product-description', el => el.innerHTML).catch(() => null)
    if (descHtml) {
        const $ = cheerio.load(descHtml)

        // Process images
        const imgs = $('img').toArray()
        for (const img of imgs) {
            const src = $(img).attr('data-src') || $(img).attr('data-lazy-src') || $(img).attr('data-original') || $(img).attr('src')
            if (src && !src.includes('data:image')) {
                const newUrl = await uploadToBunny(src, sku)
                if (newUrl) {
                    $(img).attr('src', newUrl)
                    $(img).removeAttr('data-src')
                    $(img).removeAttr('class')
                    $(img).removeAttr('style')
                } else {
                    $(img).remove()
                }
            }
        }

        // Rewrite A tags with smart two-strategy approach
        const links = $('a').toArray()
        for (const el of links) {
            const href = $(el).attr('href') || ''
            const text = $(el).text().trim()
            $(el).removeAttr('target')
            $(el).removeAttr('rel')
            if (!href.includes('hita.com.vn') && !href.startsWith('/')) continue

            const possibleSku = extractSkuFromText(text)
            if (possibleSku) {
                const productUrl = await findProductUrlBySku(possibleSku)
                if (productUrl) { $(el).attr('href', productUrl); continue }
            }

            const slugMatch = href.match(/\/([a-z0-9-]+?)(-\d+)?(?:\.html)?$/i)
            if (slugMatch) {
                const dpgSubSlug = HITA_CATEGORY_MAP[slugMatch[1]]
                $(el).attr('href', dpgSubSlug ? `/thiet-bi-ve-sinh/${dpgSubSlug}` : `/thiet-bi-ve-sinh`)
            } else {
                $(el).attr('href', '#')
            }
        }

        // Remove unwanted sections like "Tài liệu đính kèm" and "Nguyên hộp bao gồm" and "Thu gọn"
        $('.description-show-more, .btn-show-more, .read-more').remove()
        $('.description-attachments, .package-include, #box-package-include').remove()
        $('.title-header-common.tab, .product-tab-title').remove()

        let cleanHtml = $('body').html() || $.html() || ''
        cleanHtml = cleanHtml.replace(/Hita/gi, 'Đồng Phú Gia')

        result.descriptionCleanHtml = cleanHtml
    }

    // Try to click "Tài liệu sản phẩm" tab if exists
    try {
        const tabs = await page.$$('.product-tab .nav-item, .nav-tabs li')
        for (const tab of tabs) {
            const text = await tab.innerText()
            if (text.includes('Tài liệu') || text.includes('Thông số')) {
                await tab.click()
                await page.waitForTimeout(1000)
            }
        }
    } catch(e) {}

    // Process Accessories & PDFs
    const fullPageText = await page.content()
    const $ = cheerio.load(fullPageText)
    
    $('*').each((i, el) => {
        const text = $(el).text().trim()
        if (text === 'Nguyên hộp bao gồm' || text === 'Sản phẩm bao gồm' || text === 'Sản phẩm đi kèm') {
            if ($(el).prop('tagName').toLowerCase() !== 'h2' && $(el).prop('tagName').toLowerCase() !== 'h3' && $(el).prop('tagName').toLowerCase() !== 'p' && $(el).prop('tagName').toLowerCase() !== 'span') {
                return; // only process the innermost element
            }
            let container = $(el).closest('.title-common, .panel-heading, .title-header-common')
            // sometimes .panel-body is next to .title-common, sometimes .title-header-common
            let contentBody = container.next('.panel-body, .product-tab-content')
            
            if (!contentBody.length && container.parent().length) {
                contentBody = container.parent().next('.panel-body, .product-tab-content')
            }

            if (!contentBody.length) {
                contentBody = $(el).parent().next()
            }

            if (contentBody.length) {
                contentBody.find('li').each((_, li) => {
                    const item = $(li).text().replace(/^-/, '').trim()
                    if (item && !result.accessories.includes(item)) result.accessories.push(item)
                })
                
                if (result.accessories.length === 0) {
                    contentBody.find('p').each((_, p) => {
                        let text = $(p).html() || ''
                        const parts = text.split(/<br\s*\/?>/i)
                        for (const part of parts) {
                            const cleanPart = cheerio.load(part).text().replace(/^-/, '').trim()
                            if (cleanPart && !result.accessories.includes(cleanPart)) result.accessories.push(cleanPart)
                        }
                    })
                }
            }
        }
    })

    $('a').each((i, el) => {
        const href = $(el).attr('href')
        if (href && href.toLowerCase().endsWith('.pdf')) {
            let text = $(el).text().trim()
            if (!text) {
                // sometimes the text is inside a child span or it's an image. Try to find a nearby label
                text = $(el).closest('li').text().trim() || 'Tài liệu PDF'
            }
            // clean up text
            text = text.replace(/Xem|Tải về/gi, '').trim() || 'Tài liệu PDF'

            const fullLink = href.startsWith('http') ? href : `https://hita.com.vn${href}`
            if (!result.pdfLinks.find((p: any) => p.url === fullLink)) {
                result.pdfLinks.push({ name: text, url: fullLink })
            }
        }
    })

    return result
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
    console.log('--- STARTING TOTO MASS CRAWLER ---')
    
    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    if (!brand) return
    
    // Get all active TOTO products
    const allProducts = await prisma.products.findMany({
        where: { brand_id: brand.id, is_active: true },
        select: { id: true, sku: true, description: true, specs: true, source_url: true },
        orderBy: { id: 'asc' }
    })

    console.log(`Total TOTO products found: ${allProducts.length}`)

    const progress = loadProgress()
    console.log(`Already completed: ${progress.completedIds.length}, Failed: ${progress.failedIds.length}`)

    const pendingProducts = allProducts.filter(p => !progress.completedIds.includes(p.id) && !progress.failedIds.includes(p.id))
    console.log(`Pending products to crawl: ${pendingProducts.length}`)

    if (pendingProducts.length === 0) {
        console.log('🎉 All products processed!')
        return
    }

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    let count = 0
    for (const p of pendingProducts) {
        count++
        console.log(`\n[${count}/${pendingProducts.length}] Processing SKU: ${p.sku} (ID: ${p.id})`)
        
        try {
            const data = await scrapeHitaProduct(page, p.sku, p.source_url)
            
            if (!data) {
                progress.failedIds.push(p.id)
                saveProgress(progress)
                continue
            }

            console.log(`  ✅ Extracted: ${data.accessories.length} accessories, ${data.pdfLinks.length} PDFs`)
            
            // Update DB
            let specsObj = (typeof p.specs === 'object' && p.specs) ? { ...(p.specs as object) } : {}
            
            if (data.accessories.length > 0) specsObj['Phụ kiện đi kèm'] = data.accessories
            if (data.pdfLinks.length > 0) {
                specsObj.documents = data.pdfLinks
                delete specsObj['Bản vẽ kỹ thuật (PDF)'] // Clean up old format
            }

            await prisma.products.update({
                where: { id: p.id },
                data: {
                    description: data.descriptionCleanHtml || p.description,
                    specs: specsObj as any
                }
            })
            
            progress.completedIds.push(p.id)
            saveProgress(progress)
            
        } catch (err: any) {
            console.log(`  ❌ Crash processing ${p.sku}: ${err.message}`)
            progress.failedIds.push(p.id)
            saveProgress(progress)
            
            try { await browser.close() } catch(e) {}
            console.log('  🔄 Restarting browser...')
            browser = await chromium.launch({ headless: true })
            context = await browser.newContext()
            page = await context.newPage()
        }

        // Delay 2s to 4s to avoid getting blocked
        const waitTime = Math.floor(Math.random() * 2000) + 2000
        await delay(waitTime)
    }

    await browser.close()
    console.log('\n--- MASS CRAWL COMPLETE ---')
}

main().catch(console.error).finally(() => prisma.$disconnect())
