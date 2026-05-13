import { chromium } from 'playwright'

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('https://hita.com.vn/tim-kiem?q=MS885DT8')
  await page.waitForTimeout(3000)
  
  const links = await page.$$eval('a', as => as.map(a => a.href))
  const prods = links.filter(h => h.includes('.html'))
  
  console.log('Found product links:', Array.from(new Set(prods)))
  await browser.close()
}

run()
