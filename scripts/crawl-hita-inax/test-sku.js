import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://hita.com.vn/bon-cau-1-khoi-inax-ac-1008vrn-543.html', { waitUntil: 'domcontentloaded' });
  const sku = await page.locator('.product-code').innerText().catch(() => 'no .product-code');
  const allCodes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="code"], [class*="sku"], span')).map(e => e.innerText).filter(t => t.includes('Mã SP'));
  });
  console.log('SKU with .product-code:', sku);
  console.log('All matching "Mã SP":', allCodes.slice(0, 5));
  await browser.close();
})();
