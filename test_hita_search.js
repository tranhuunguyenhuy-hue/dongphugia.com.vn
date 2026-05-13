const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const sku = 'MS885DT8#XW';
  const searchUrl = `https://hita.com.vn/tim-kiem?q=${encodeURIComponent(sku)}`;
  
  console.log('Navigating to', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  
  // wait for products list
  await page.waitForTimeout(2000);
  
  // try to find the first product link
  const productLink = await page.$('.product-item .product-info h3 a');
  if (productLink) {
    const href = await productLink.getAttribute('href');
    console.log('Found product href:', href);
    
    await page.goto('https://hita.com.vn' + href, { waitUntil: 'domcontentloaded' });
    
    // Check for "Xem thêm"
    const xemThem = await page.$('.btn-show-more');
    if (xemThem) {
        console.log('Clicking Xem them...');
        await xemThem.click();
        await page.waitForTimeout(1000);
    }
    
    const desc = await page.$('.description-content');
    if (desc) {
       console.log('Found description length:', (await desc.innerHTML()).length);
    } else {
       console.log('No description-content found');
    }
    
  } else {
    console.log('No product link found from search');
  }

  await browser.close();
}

run().catch(console.error);
