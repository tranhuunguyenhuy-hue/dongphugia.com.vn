import https from 'https';
import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = 'scripts/crawl-inax/output/inax-master-urls.json';

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch ${url}. Status code: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function runDiscovery() {
    console.log('--- STARTING INAX DISCOVERY (SITEMAP STRATEGY) ---');
    
    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log('1. Fetching root product sitemap...');
    const rootXml = await fetchUrl('https://hita.com.vn/product-sitemap.xml');
    
    const pageMatches = rootXml.match(/<loc>(.*?)<\/loc>/g);
    if (!pageMatches) {
        console.log('No sitemap pages found.');
        return;
    }
    
    const sitemapPages = pageMatches.map(m => m.replace(/<\/?loc>/g, ''));
    console.log(`Found ${sitemapPages.length} sitemap pages.`);

    const allInaxUrls = new Set();

    console.log('2. Fetching each sitemap page...');
    for (let i = 0; i < sitemapPages.length; i++) {
        const pageUrl = sitemapPages[i].replace(/&amp;/g, '&');
        console.log(` -> Fetching ${pageUrl} (${i+1}/${sitemapPages.length})`);
        try {
            const pageXml = await fetchUrl(pageUrl);
            const urlMatches = pageXml.match(/<loc>(.*?)<\/loc>/g);
            if (urlMatches) {
                const urls = urlMatches.map(m => m.replace(/<\/?loc>/g, ''));
                let inaxCount = 0;
                urls.forEach(u => {
                    if (u.includes('inax') && u.endsWith('.html')) {
                        allInaxUrls.add(u);
                        inaxCount++;
                    }
                });
                console.log(`    Found ${inaxCount} INAX products.`);
            }
        } catch (err) {
            console.error(`    Error fetching ${pageUrl}:`, err.message);
        }
    }

    const finalArray = Array.from(allInaxUrls).map(url => ({
        url: url,
        title: url.split('/').pop().replace('.html', '').replace(/-/g, ' ')
    }));

    console.log(`\n--- DISCOVERY COMPLETE ---`);
    console.log(`Total unique INAX products found: ${finalArray.length}`);
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalArray, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

runDiscovery().catch(console.error);
