const fs = require('fs');
const path = require('path');
const https = require('https');

const brands = [
    { name: "TOTO", slug: "toto" },
    { name: "INAX", slug: "inax" },
    { name: "Caesar", slug: "caesar" },
    { name: "Viglacera", slug: "viglacera" },
    { name: "Hafele", slug: "hafele" },
    { name: "Bosch", slug: "bosch" },
    { name: "Cotto", slug: "cotto" },
    { name: "Jomoo", slug: "jomoo" },
    { name: "American Standard", slug: "american-standard" },
    { name: "Kohler", slug: "kohler" }
];

async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return downloadImage(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

function extractImgs(html) {
    // extract data-src or src
    const rx = /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi;
    let match;
    const imgs = [];
    while ((match = rx.exec(html)) !== null) {
        let src = match[1];
        if (src.startsWith('data:')) continue;
        if (src.includes('dummy')) continue; // Skip dummy lazy-load placeholders
        if (!src.startsWith('http')) {
            src = `https://www.tdm.vn${src.startsWith('/') ? '' : '/'}${src}`;
        }
        imgs.push({ src, full_match: match[0].toLowerCase() });
    }
    return imgs;
}

async function scrapeBrands() {
    try {
        console.log('Fetching tdm.vn ...');
        const response = await fetch('https://www.tdm.vn/');
        const text = await response.text();
        const allImgs = extractImgs(text);

        for (const brand of brands) {
            console.log(`Checking ${brand.name}...`);
            let foundSrc = null;

            // Search in global home page first
            for (const img of allImgs) {
                if (img.full_match.includes(brand.slug.replace('-', '')) && (img.src.includes('logo') || img.full_match.includes('logo'))) {
                    foundSrc = img.src;
                    break;
                }
            }

            if (!foundSrc) {
                // search direct brand page
                try {
                    const bRes = await fetch(`https://www.tdm.vn/${brand.slug}`);
                    if (bRes.ok) {
                        const bText = await bRes.text();
                        const bImgs = extractImgs(bText);
                        for (const img of bImgs) {
                            if (img.src.includes('logo') || img.full_match.includes(brand.slug.replace('-', ''))) {
                                foundSrc = img.src;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.log(`Failed to fetch ${brand.name} page`, e.message);
                }
            }

            if (foundSrc) {
                console.log(`Found logo for ${brand.name}: ${foundSrc}`);
                const ext = foundSrc.split('.').pop().split('?')[0] || 'png';
                const destDir = path.join(__dirname, 'public', 'images', 'brands');
                fs.mkdirSync(destDir, { recursive: true });
                const dest = path.join(destDir, `${brand.slug}.${ext}`);
                
                await downloadImage(foundSrc, dest);
                brand.logoUrl = `/images/brands/${brand.slug}.${ext}`;
            } else {
                console.log(`No logo found for ${brand.name}`);
            }
        }
        
        console.log('\n--- final mapped brands ---');
        console.log(JSON.stringify(brands, null, 2));

        let updateCode = 'const BRANDS = [\n';
        for (const b of brands) {
            updateCode += `    { name: "${b.name}", logoText: "${b.name.toUpperCase()}", logoUrl: "${b.logoUrl || ''}" },\n`;
        }
        updateCode += ']\n';
        fs.writeFileSync(path.join(__dirname, 'brand_patch.txt'), updateCode);
        console.log('Saved to brand_patch.txt');

    } catch (err) {
        console.error(err);
    }
}

scrapeBrands();
