import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

async function main() {
    console.log('--- STARTING PDF FIX CRAWLER ---')
    
    // Read the completed IDs from progress file to know which ones to fix
    const fs = require('fs')
    const path = require('path')
    const progressFile = path.join(__dirname, 'crawl_toto_progress.json')
    if (!fs.existsSync(progressFile)) return
    
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'))
    const idsToFix = progress.completedIds

    const products = await prisma.products.findMany({
        where: { id: { in: idsToFix } },
        select: { id: true, sku: true, specs: true, source_url: true }
    })

    console.log(`Found ${products.length} products to fix.`)

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    let count = 0
    for (const p of products) {
        count++
        if (!p.source_url || !p.source_url.includes('hita.com.vn')) continue

        console.log(`[${count}/${products.length}] Fixing PDFs for SKU: ${p.sku} (ID: ${p.id})`)
        
        try {
            await page.goto(p.source_url, { waitUntil: 'domcontentloaded', timeout: 30000 })
            
            try {
                const tabs = await page.$$('.product-tab .nav-item, .nav-tabs li')
                for (const tab of tabs) {
                    const text = await tab.innerText()
                    if (text.includes('Tài liệu') || text.includes('Thông số')) {
                        await tab.click()
                        await page.waitForTimeout(500)
                    }
                }
            } catch(e) {}

            const fullPageText = await page.content()
            const $ = cheerio.load(fullPageText)
            
            const pdfLinks: any[] = []
            
            $('a').each((i, el) => {
                const href = $(el).attr('href')
                if (href && href.toLowerCase().endsWith('.pdf')) {
                    let text = $(el).text().trim()
                    if (!text) {
                        text = $(el).closest('li').text().trim() || 'Tài liệu PDF'
                    }
                    text = text.replace(/Xem|Tải về/gi, '').trim() || 'Tài liệu PDF'

                    const fullLink = href.startsWith('http') ? href : `https://hita.com.vn${href}`
                    if (!pdfLinks.find(p => p.url === fullLink)) {
                        pdfLinks.push({ name: text, url: fullLink })
                    }
                }
            })

            if (pdfLinks.length > 0) {
                let specsObj = (typeof p.specs === 'object' && p.specs) ? { ...(p.specs as object) } : {}
                
                specsObj.documents = pdfLinks
                // remove the hardcoded key
                delete specsObj['Bản vẽ kỹ thuật (PDF)']
                // optionally remove 'Thông số kỹ thuật' if its value is a PDF link
                if (typeof specsObj['Thông số kỹ thuật'] === 'string' && specsObj['Thông số kỹ thuật'].endsWith('.pdf')) {
                    delete specsObj['Thông số kỹ thuật']
                }

                await prisma.products.update({
                    where: { id: p.id },
                    data: { specs: specsObj as any }
                })
                console.log(`  ✅ Updated ${pdfLinks.length} PDFs`)
            }

        } catch (err: any) {
            console.log(`  ❌ Failed: ${err.message}`)
        }
    }

    await browser.close()
    console.log('\n--- PDF FIX COMPLETE ---')
}

main().catch(console.error).finally(() => prisma.$disconnect())
