const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPlaywrightCrawl(sku) {
    console.log(`Starting Playwright crawler for SKU: ${sku}...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        console.log(`Navigating to search page...`);
        await page.goto(`https://hita.com.vn/tim-kiem.html?kw=${sku}`, { waitUntil: 'domcontentloaded' });
        await delay(2000); // Wait for potential JS rendering

        // Try to find the product link
        const productLinks = await page.$$eval('a', anchors => {
            return anchors
                .map(a => a.href)
                .filter(href => href.includes('.html') && !href.includes('tim-kiem'));
        });

        console.log(`Found ${productLinks.length} potential product links.`);
        
        let targetUrl = null;
        for (const link of productLinks) {
            if (link.toLowerCase().includes(sku.toLowerCase())) {
                targetUrl = link;
                break;
            }
        }

        // Fallback: take first distinct product link if no exact match
        if (!targetUrl && productLinks.length > 0) {
            const uniqueLinks = [...new Set(productLinks)];
            if (uniqueLinks.length === 1) targetUrl = uniqueLinks[0];
            else console.log("Too many links, not sure which is the product.", uniqueLinks.slice(0, 3));
        }

        if (targetUrl) {
            console.log(`Navigating to Product URL: ${targetUrl}`);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await delay(2000);

            // Extract Name
            const name = await page.$eval('h1, h1.product-name', el => el.innerText.trim()).catch(() => 'N/A');
            
            // Extract Price
            const priceText = await page.$eval('.price, .special-price, .product-price', el => el.innerText.trim()).catch(() => 'N/A');
            
            // Extract Image
            const imgUrl = await page.$eval('.product-image img, .img-box img', el => el.src).catch(() => 'N/A');

            console.log("\n--- Crawl Result ---");
            console.log(`Name: ${name}`);
            console.log(`Price: ${priceText}`);
            console.log(`Image: ${imgUrl}`);
            console.log("--------------------\n");
        } else {
            console.log("Could not find a matching product URL for this SKU on the search page.");
        }

    } catch (e) {
        console.error("Error during crawling:", e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }
}

testPlaywrightCrawl('TAF400H');
