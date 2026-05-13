import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

async function main() {
    const ids = [676, 677, 678, 679, 680, 681, 682, 683, 684, 685];
    const products = await prisma.products.findMany({
        where: { id: { in: ids } },
        select: { id: true, sku: true, source_url: true, specs: true }
    });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    for (const p of products) {
        if (!p.source_url) continue;
        console.log(`Fixing specs for ${p.sku}...`);
        
        const page = await context.newPage();
        try {
            await page.goto(p.source_url.startsWith('http') ? p.source_url : 'https://hita.com.vn' + p.source_url, { timeout: 30000 });
            await page.waitForTimeout(1000);
            
            const html = await page.content();
            const $ = cheerio.load(html);
            
            const newSpecs: any = typeof p.specs === 'object' && p.specs ? { ...p.specs } : {};
            
            // Tìm bảng Thông số kỹ thuật
            $('table').each((_, table) => {
                const text = $(table).text().toLowerCase();
                if (text.includes('mã sản phẩm') || text.includes('thương hiệu') || text.includes('kích thước')) {
                    $(table).find('tr').each((_, tr) => {
                        const key = $(tr).find('td').eq(0).text().replace(':', '').trim();
                        const val = $(tr).find('td').eq(1).text().trim();
                        if (key && val) {
                            newSpecs[key] = val;
                        }
                    });
                }
            });
            
            await prisma.products.update({
                where: { id: p.id },
                data: { specs: newSpecs }
            });
            console.log(`✅ Fixed specs for ${p.sku}, total keys: ${Object.keys(newSpecs).length}`);
        } catch (e: any) {
            console.error(`❌ Failed ${p.sku}: ${e.message}`);
        }
        await page.close();
    }
    await browser.close();
    await prisma.$disconnect();
}
main();
