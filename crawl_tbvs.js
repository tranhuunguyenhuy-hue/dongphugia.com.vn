const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

function logMsg(msg) {
    const output = `[${new Date().toISOString()}] ${msg}`;
    console.log(output);
    fs.appendFileSync('crawl_tbvs.log', output + '\n');
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateSlug(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

async function fixMissingRelationships() {
    logMsg("Phase 1: Finding missing SKUs in product_relationships...");
    const relationships = await prisma.product_relationships.findMany({
        where: { relationship_type: 'component', child_id: null },
    });
    const skus = [...new Set(relationships.map(r => r.child_sku).filter(Boolean))];
    
    const existingProducts = await prisma.products.findMany({
        where: { sku: { in: skus } },
        select: { sku: true, id: true }
    });
    const existingSkus = new Set(existingProducts.map(p => p.sku));
    const missingSkus = skus.filter(sku => !existingSkus.has(sku));
    
    logMsg(`Found ${missingSkus.length} missing SKUs out of ${skus.length} total required SKUs.`);
    return missingSkus;
}

async function crawlSkuList(context, skus) {
    for (let i = 0; i < skus.length; i++) {
        const sku = skus[i];
        logMsg(`[${i+1}/${skus.length}] Crawling missing SKU: ${sku}`);
        const page = await context.newPage();
        
        try {
            await page.goto(`https://hita.com.vn/tim-kiem.html?kw=${sku}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await delay(2000);

            const productLinks = await page.$$eval('.product-item a, .item-product a', anchors => {
                return [...new Set(anchors.map(a => a.href).filter(h => h.includes('.html') && !h.includes('tim-kiem')))];
            });

            let targetUrl = null;
            if (productLinks.length > 0) {
                targetUrl = productLinks.find(l => l.toLowerCase().includes(sku.toLowerCase())) || productLinks[0];
            }

            if (targetUrl) {
                logMsg(`   -> Found Product URL: ${targetUrl}`);
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await delay(1500);

                const name = await page.$eval('h1, .product-name', el => el.innerText.trim()).catch(() => null);
                let priceStr = await page.$eval('.special-price, .price', el => el.innerText.replace(/[^\d]/g, '')).catch(() => null);
                const image = await page.$eval('.product-image img, .img-box img', el => el.src).catch(() => null);

                if (name) {
                    const price = priceStr ? parseInt(priceStr) : null;
                    const slug = generateSlug(name) + '-' + sku.toLowerCase();
                    
                    const existing = await prisma.products.findFirst({ where: { sku } });
                    if (!existing) {
                        const newProduct = await prisma.products.create({
                            data: {
                                sku,
                                name,
                                slug,
                                price,
                                image_main_url: image,
                                category_id: 1, // Defaulting to Thiết bị vệ sinh
                                is_active: false,
                                stock_status: 'in_stock'
                            }
                        });
                        logMsg(`   [+] Inserted Draft Product: ${sku} - ID: ${newProduct.id}`);
                        
                        // Map the relationship
                        const updated = await prisma.product_relationships.updateMany({
                            where: { child_sku: sku, child_id: null },
                            data: { child_id: newProduct.id }
                        });
                        logMsg(`   [*] Mapped child_id for ${updated.count} relationship(s).`);
                    } else {
                        logMsg(`   [-] Product ${sku} already exists.`);
                    }
                } else {
                    logMsg(`   [!] Could not extract name from product page.`);
                }
            } else {
                logMsg(`   [!] No search results found for SKU: ${sku}`);
            }
        } catch (e) {
            logMsg(`   [X] Error crawling ${sku}: ${e.message}`);
        } finally {
            await page.close();
        }
    }
}

async function runPipeline() {
    logMsg("=== DATA PIPELINE INITIATED ===");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    try {
        // Phase 1: Crawl Missing SKUs for Combos
        const missingSkus = await fixMissingRelationships();
        if (missingSkus.length > 0) {
            logMsg(`Starting crawl for ${missingSkus.length} missing SKUs...`);
            await crawlSkuList(context, missingSkus);
        }

        logMsg("=== PHASE 1 COMPLETED ===");
        logMsg("You can add Category Crawl later if needed.");

    } catch (e) {
        logMsg(`Pipeline Fatal Error: ${e.message}`);
    } finally {
        await browser.close();
        await prisma.$disconnect();
        logMsg("=== DATA PIPELINE TERMINATED ===");
    }
}

runPipeline();
