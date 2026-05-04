const axios = require('axios');
const cheerio = require('cheerio');

async function testCrawl(sku) {
    try {
        console.log(`Searching for SKU: ${sku}`);
        const response = await axios.get(`https://hita.com.vn/tim-kiem.html?kw=${sku}`);
        const $ = cheerio.load(response.data);
        
        // Find product blocks. Often .product-item, .item, etc.
        // Hita might use a different selector. Let's dump out some clues.
        const products = [];
        $('.product-item, .item-product, .product').each((i, el) => {
            const name = $(el).find('h3, .name, .product-name').text().trim();
            const link = $(el).find('a').attr('href');
            if (name) {
                products.push({ name, link });
            }
        });
        
        if (products.length > 0) {
            console.log(`Found ${products.length} products on search page:`);
            console.log(products[0]);
        } else {
            console.log(`Could not find products using standard classes. Checking raw HTML...`);
            const title = $('title').text();
            console.log("Page Title:", title);
            // look for any <a> tags containing the SKU
            const aTags = [];
            $('a').each((i, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href');
                if (text.includes(sku) || (href && href.includes(sku.toLowerCase()))) {
                    aTags.push({ text, href });
                }
            });
            console.log("Possible links matching SKU:", aTags.slice(0, 3));
        }
    } catch (e) {
        console.error("Error fetching:", e.message);
    }
}

testCrawl('TAF400H');
