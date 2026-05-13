import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://hita.com.vn/bon-cau-1-khoi-nap-rua-dien-tu-s7-toto-ms636cdrw12-6467.html', { waitUntil: 'domcontentloaded' });
    try { await page.click('.description-show-more'); await page.waitForTimeout(1000); } catch(e) {}
    
    const fullPageText = await page.content()
    const $ = cheerio.load(fullPageText)
    
    $('*').each((i, el) => {
        const text = $(el).text().trim()
        if (text === 'Nguyên hộp bao gồm') {
            if ($(el).prop('tagName').toLowerCase() !== 'h2') return;
            
            console.log('--- FOUND HEADER ---');
            let current = $(el);
            for (let j = 0; j < 5; j++) {
                current = current.parent();
                console.log(`Parent ${j+1}:`, current.prop('tagName'), current.attr('class'));
                
                const nexts = current.nextAll();
                if (nexts.length) {
                    console.log(`  -> Siblings:`);
                    nexts.each((idx, sibling) => {
                        console.log(`     `, $(sibling).prop('tagName'), $(sibling).attr('class'));
                    });
                }
            }
        }
    })
    await browser.close();
})();
