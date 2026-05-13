import { PrismaClient } from '@prisma/client'
import { chromium, Page } from 'playwright'
import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

// Bunny CDN Config
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME || 'dpg-products'
const BUNNY_API_KEY = process.env.BUNNY_STORAGE_API_KEY || ''
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'
const BUNNY_CDN_HOST = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

const turndownService = new TurndownService({ headingStyle: 'atx' })

// Configure Turndown to keep img tags if we want to retain them inline (or let it convert to markdown ![])
// Turndown converts <img> to ![alt](src) by default, which is good.

async function uploadToBunny(imageUrl: string, sku: string): Promise<string | null> {
    try {
        if (!imageUrl.startsWith('http')) {
            imageUrl = 'https://hita.com.vn' + imageUrl
        }
        console.log(`Downloading image: ${imageUrl}`)
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
        console.error(`Failed to upload ${imageUrl}: ${error.message}`)
        return null
    }
}

async function scrapeHitaProduct(page: Page, sku: string, sourceUrl: string | null) {
    if (!sourceUrl || !sourceUrl.includes('hita.com.vn')) {
        console.log(`❌ SKU ${sku} has no valid Hita source URL (${sourceUrl}).`)
        return null
    }

    console.log(`Navigating to ${sourceUrl}`)
    
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    console.log(`Landed on product page: ${sourceUrl}`)

    // 2. Click "Xem thêm" in description
    try {
        const xemThem = await page.$('.description-show-more, .btn-show-more')
        if (xemThem) {
            console.log(`Clicking "Xem thêm"...`)
            await xemThem.click()
            await page.waitForTimeout(1000) // wait for animation
        }
    } catch (e) {
        // ignore
    }

    const result: any = {
        descriptionMd: '',
        accessories: [],
        pdfLinks: []
    }

    // 3. Process Description
    const descHtml = await page.$eval('.description-content, #box-description, .product-description', el => el.innerHTML).catch(() => null)
    if (descHtml) {
        console.log(`Original desc length: ${descHtml.length}`)
        const $ = cheerio.load(descHtml)

        // Process images
        const imgs = $('img').toArray()
        for (const img of imgs) {
            const src = $(img).attr('src') || $(img).attr('data-src')
            if (src) {
                const newUrl = await uploadToBunny(src, sku)
                if (newUrl) {
                    $(img).attr('src', newUrl)
                    $(img).removeAttr('data-src')
                    $(img).removeAttr('class')
                    $(img).removeAttr('style')
                } else {
                    $(img).remove() // remove broken images
                }
            }
        }

        // Clean A tags (remove href, keep text)
        $('a').each((i, el) => {
            const text = $(el).text()
            $(el).replaceWith(`<span>${text}</span>`)
        })

        // Remove competitor brand names
        let cleanHtml = $('body').html() || $.html() || ''
        cleanHtml = cleanHtml.replace(/Hita/gi, 'Đồng Phú Gia')

        result.descriptionCleanHtml = cleanHtml
        console.log(`Clean desc length: ${cleanHtml.length}`)
    } else {
        console.log(`⚠️ No description found for ${sku}`)
    }

    // 4. Try to click "Tài liệu sản phẩm" tab if exists
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

    // 5. Look for "Nguyên hộp bao gồm" or "Sản phẩm bao gồm"
    const fullPageText = await page.content()
    const $ = cheerio.load(fullPageText)
    
    // Find headings
    $('*').each((i, el) => {
        const text = $(el).text().trim()
        if (text === 'Nguyên hộp bao gồm' || text === 'Sản phẩm bao gồm' || text === 'Sản phẩm đi kèm') {
            console.log("Found Accessories Heading!")
            const nextUl = $(el).nextAll('ul').first()
            if (nextUl.length) {
                nextUl.find('li').each((_, li) => {
                    const item = $(li).text().replace(/^-/, '').trim()
                    if (item) result.accessories.push(item)
                })
            } else {
                // Try looking for paragraphs
                const nextP = $(el).nextAll('p')
                nextP.each((_, p) => {
                    const item = $(p).text().replace(/^-/, '').trim()
                    if (item) result.accessories.push(item)
                })
            }
        }
    })

    // Look for PDF links
    $('a').each((i, el) => {
        const href = $(el).attr('href')
        if (href && href.endsWith('.pdf')) {
            const fullLink = href.startsWith('http') ? href : `https://hita.com.vn${href}`
            if (!result.pdfLinks.includes(fullLink)) {
                result.pdfLinks.push(fullLink)
            }
        }
    })

    return result
}

async function main() {
    console.log('--- STARTING TOTO PILOT CRAWLER ---')
    
    // 1. Get 3 pilot SKUs
    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    if (!brand) return
    
    const pilotProducts = await prisma.products.findMany({
        where: { brand_id: brand.id, is_active: true },
        take: 3,
        // specifically test with a toilet
        orderBy: { created_at: 'desc' }
    })

    // Injecting MS885DT8#XW specifically to test the user's example
    const specificTest = await prisma.products.findFirst({ where: { sku: 'MS885DT8#XW' } })
    if (specificTest) pilotProducts[0] = specificTest

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    for (const p of pilotProducts) {
        console.log(`\n===========================================`)
        console.log(`Processing SKU: ${p.sku}`)
        
        const data = await scrapeHitaProduct(page, p.sku, p.source_url)
        if (!data) continue

        console.log('--- Extracted Data ---')
        console.log('Accessories:', data.accessories)
        console.log('PDFs:', data.pdfLinks)
        console.log('Desc Markdown Length:', data.descriptionMd.length)
        
        // Update DB
        let specsObj = (typeof p.specs === 'object' && p.specs) ? { ...(p.specs as object) } : {}
        
        if (data.accessories.length > 0) {
            specsObj['Phụ kiện đi kèm'] = data.accessories
        }
        if (data.pdfLinks.length > 0) {
            specsObj['Bản vẽ kỹ thuật (PDF)'] = data.pdfLinks[0] // or array
        }

        await prisma.products.update({
            where: { id: p.id },
            data: {
                description: data.descriptionCleanHtml || p.description, 
                specs: specsObj as any
            }
        })
        console.log(`✅ Updated DB for ${p.sku}`)
    }

    await browser.close()
    console.log('\n--- PILOT CRAWL COMPLETE ---')
}

main().catch(console.error).finally(() => prisma.$disconnect())
