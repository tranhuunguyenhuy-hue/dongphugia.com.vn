async function testCrawl(sku) {
    console.log(`Searching for SKU: ${sku}`);
    const response = await fetch(`https://hita.com.vn/tim-kiem.html?kw=${sku}`);
    const html = await response.text();
    console.log(`HTML length: ${html.length}`);
    
    // Check if there's any API call hidden in the HTML
    const apiMatch = html.match(/https:\/\/api\.hita\.com\.vn[^"'\s]+/g);
    if (apiMatch) {
        console.log("Found APIs in HTML:", [...new Set(apiMatch)].slice(0, 5));
    }
    
    // Look for product names using common classes
    const titles = html.match(/class="product-name"[^>]*>([^<]+)/g);
    if (titles) {
        console.log("Titles:", titles.slice(0, 5));
    }
}

testCrawl('TAF400H');
