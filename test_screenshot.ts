import { chromium } from 'playwright'

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('https://hita.com.vn/tim-kiem?q=MS885DT8')
  await page.waitForTimeout(4000)
  
  await page.screenshot({ path: 'hita_search.png' })
  await browser.close()
}

run()
