import { chromium } from 'playwright';
import fs from 'fs';

async function research() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Visiting INAX Toilets listing...');
    await page.goto('https://hita.com.vn/bon-cau-inax-101.html', { waitUntil: 'domcontentloaded' });
    
    // Get the first product link
    const firstProduct = await page.$('.product-box-item a');
    let productUrl = '';
    if (firstProduct) {
        productUrl = await firstProduct.getAttribute('href');
        if (!productUrl.startsWith('http')) {
            productUrl = 'https://hita.com.vn' + productUrl;
        }
        console.log(`Found first toilet URL: ${productUrl}`);
    } else {
        console.log('No product links found.');
        await browser.close();
        return;
    }

    console.log(`Visiting product page: ${productUrl}...`);
    await page.goto(productUrl, { waitUntil: 'networkidle' });
    
    // Extract full HTML
    const html = await page.content();
    fs.writeFileSync('scripts/crawl-inax/product-sample.html', html);
    console.log('Saved toilet HTML to scripts/crawl-inax/product-sample.html');

    await browser.close();
}

research().catch(console.error);
