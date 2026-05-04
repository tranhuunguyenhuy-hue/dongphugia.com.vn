async function testCrawl(sku) {
    try {
        console.log(`Searching for SKU: ${sku}`);
        const response = await fetch(`https://hita.com.vn/tim-kiem.html?kw=${sku}`);
        const html = await response.text();
        
        // Let's do a simple regex search to see if we can find a product link containing the SKU
        const matches = html.match(/href="([^"]+)"[^>]*>([^<]*)/g);
        const links = [];
        if (matches) {
            for (const match of matches) {
                if (match.toLowerCase().includes(sku.toLowerCase())) {
                    links.push(match);
                }
            }
        }
        
        console.log(`Found ${links.length} potential links matching SKU.`);
        if (links.length > 0) {
            // Find the first product link
            const productMatch = links.find(l => l.includes('.html') && !l.includes('tim-kiem'));
            if (productMatch) {
                const urlMatch = productMatch.match(/href="([^"]+)"/);
                if (urlMatch) {
                    const productUrl = urlMatch[1];
                    console.log(`Found Product URL: ${productUrl}`);
                    
                    // Now fetch product page
                    const prodRes = await fetch(productUrl.startsWith('http') ? productUrl : `https://hita.com.vn${productUrl}`);
                    const prodHtml = await prodRes.text();
                    
                    // Try to extract Name and Price using regex or JSON-LD
                    const titleMatch = prodHtml.match(/<title>([^<]+)<\/title>/);
                    console.log("Title:", titleMatch ? titleMatch[1] : 'N/A');
                    
                    // Look for JSON-LD Product
                    const jsonLdMatch = prodHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
                    if (jsonLdMatch) {
                        for (const script of jsonLdMatch) {
                            if (script.includes('"@type": "Product"') || script.includes('"@type":"Product"')) {
                                const jsonText = script.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
                                try {
                                    const json = JSON.parse(jsonText);
                                    console.log("JSON-LD found:");
                                    console.log(`- Name: ${json.name}`);
                                    if (json.offers) {
                                        console.log(`- Price: ${json.offers.price} ${json.offers.priceCurrency}`);
                                    }
                                    if (json.image) {
                                        console.log(`- Image: ${Array.isArray(json.image) ? json.image[0] : json.image}`);
                                    }
                                } catch (e) {
                                    console.log("JSON-LD parse error:", e.message);
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error fetching:", e.message);
    }
}

testCrawl('TAF400H');
