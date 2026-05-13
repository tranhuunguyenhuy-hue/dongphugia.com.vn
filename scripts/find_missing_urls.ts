import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

async function main() {
    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } });
    const missing = await prisma.products.findMany({
        where: { 
            brand_id: brand.id,
            source_url: null,
            is_active: true
        },
        select: { id: true, sku: true, name: true, is_combo: true }
    });

    console.log(`Tìm thấy ${missing.length} sản phẩm thiếu URL. Đang search trên Hita...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    let updatedCount = 0;

    for (const item of missing) {
        // Lấy mã SKU chính (phần trước dấu / nếu là combo ghép)
        let searchSku = item.sku.split('/')[0].split('#')[0].trim();
        
        const page = await context.newPage();
        try {
            const searchUrl = `https://hita.com.vn/tim-kiem.html?keyword=${encodeURIComponent(searchSku)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
            
            // Lấy href của kết quả tìm kiếm đầu tiên
            const firstResult = await page.$('.product-item a');
            if (firstResult) {
                const href = await firstResult.getAttribute('href');
                if (href) {
                    await prisma.products.update({
                        where: { id: item.id },
                        data: { source_url: href }
                    });
                    console.log(`✅ [${item.sku}] -> Tìm thấy: ${href}`);
                    updatedCount++;
                } else {
                    console.log(`❌ [${item.sku}] -> Không có kết quả search.`);
                }
            } else {
                console.log(`❌ [${item.sku}] -> Không có kết quả search.`);
            }
        } catch (e: any) {
            console.error(`⚠️ Error [${item.sku}]: ${e.message}`);
        }
        await page.close();
    }
    
    console.log(`\n🎉 Đã cập nhật thành công ${updatedCount}/${missing.length} URL.`);
    await browser.close();
    await prisma.$disconnect();
}
main();
