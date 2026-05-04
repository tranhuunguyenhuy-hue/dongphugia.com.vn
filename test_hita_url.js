const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://hita.com.vn/');
  const links = await page.$$eval('a', anchors => anchors.map(a => a.href));
  console.log("All unique links on homepage:");
  const uniqueLinks = [...new Set(links)].filter(l => l.includes('thiet-bi'));
  console.log(uniqueLinks);
  await browser.close();
})();
