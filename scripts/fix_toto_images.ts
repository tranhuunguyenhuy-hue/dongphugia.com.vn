import { PrismaClient } from '@prisma/client'
import { chromium, Page } from 'playwright'
import * as cheerio from 'cheerio'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()
const prisma = new PrismaClient()

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

const progressFile = path.join(__dirname, 'crawl_toto_progress.json')

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

async function scrapeHitaDescription(page: Page, sku: string, sourceUrl: string | null) {
    if (!sourceUrl || !sourceUrl.includes('hita.com.vn')) return null

    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1000)

    try {
        const xemThem = await page.$('.description-show-more, .btn-show-more')
        if (xemThem) {
            await xemThem.click()
            await page.waitForTimeout(1000)
        }
    } catch (e) {}

    const descHtml = await page.$eval('.description-content, #box-description, .product-description', el => el.innerHTML).catch(() => null)
    if (!descHtml) return null

    const $ = cheerio.load(descHtml)

    const imgs = $('img').toArray()
    let updatedImages = 0
    for (const img of imgs) {
        // Correct lazy-load extraction
        const src = $(img).attr('data-src') || $(img).attr('data-lazy-src') || $(img).attr('data-original') || $(img).attr('src')
        if (src && !src.includes('data:image')) {
            const newUrl = await uploadToBunny(src, sku)
            if (newUrl) {
                $(img).attr('src', newUrl)
                $(img).removeAttr('data-src')
                $(img).removeAttr('data-lazy-src')
                $(img).removeAttr('data-original')
                $(img).removeAttr('class')
                $(img).removeAttr('style')
                updatedImages++
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

    return { cleanHtml, updatedImages }
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
    console.log('--- STARTING IMAGE DESCRIPTION FIX CRAWLER ---')
    
    if (!fs.existsSync(progressFile)) return
    
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'))
    // Start fixing the ones that were marked as completed but have broken images
    const idsToFix = progress.completedIds

    const products = await prisma.products.findMany({
        where: { id: { in: idsToFix } },
        select: { id: true, sku: true, source_url: true, description: true }
    })

    console.log(`Found ${products.length} products to check.`)

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    let count = 0
    for (const p of products) {
        count++
        if (!p.source_url || !p.source_url.includes('hita.com.vn')) continue
        
        // If the description doesn't have the broken "original.jpg" or loading placeholder, skip it?
        // Wait, the broken image URL usually contains 'original.jpg' or 'icon-pdf.png' or we can just re-crawl it if it has BunnyCDN urls but we know they were wrong.
        // Actually, let's just re-crawl it. It's safer.
        console.log(`\n[${count}/${products.length}] Fixing Description for SKU: ${p.sku} (ID: ${p.id})`)
        
        try {
            const data = await scrapeHitaDescription(page, p.sku, p.source_url)
            
            if (data && data.cleanHtml) {
                await prisma.products.update({
                    where: { id: p.id },
                    data: { description: data.cleanHtml }
                })
                console.log(`  ✅ Updated description with ${data.updatedImages} proper images`)
            }

        } catch (err: any) {
            console.log(`  ❌ Failed: ${err.message}`)
            try {
                await browser.close()
            } catch(e) {}
            // Restart browser
            console.log('  🔄 Restarting browser...')
            browser = await chromium.launch({ headless: true })
            context = await browser.newContext()
            page = await context.newPage()
        }

        const waitTime = Math.floor(Math.random() * 2000) + 1500
        await delay(waitTime)
    }

    await browser.close()
    console.log('\n--- IMAGE FIX COMPLETE ---')
}

main().catch(console.error).finally(() => prisma.$disconnect())
