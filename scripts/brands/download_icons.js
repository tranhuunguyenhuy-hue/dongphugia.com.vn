const fs = require('fs');
const https = require('https');
const sharp = require('sharp');

const missingBrands = [
  { slug: 'grohe', domain: 'grohe.com' },
  { slug: 'teka', domain: 'teka.com' },
  { slug: 'malloca', domain: 'malloca.com' },
  { slug: 'electrolux', domain: 'electrolux.vn' },
  { slug: 'siemens', domain: 'siemens.com' },
  { slug: 'faster', domain: 'faster.vn' },
  { slug: 'canzy', domain: 'canzy.com.vn' },
  { slug: 'giovani', domain: 'giovani.vn' },
  { slug: 'dai-thanh', domain: 'tanadaithanh.vn' },
  { slug: 'son-ha', domain: 'sonha.com.vn' },
  { slug: 'ferroli', domain: 'ferroli.com.vn' },
  { slug: 'ariston', domain: 'ariston.com' },
  { slug: 'kangaroo', domain: 'kangaroo.vn' },
  { slug: 'sunhouse', domain: 'sunhouse.com.vn' },
  { slug: 'midea', domain: 'midea.com' }
];

async function fetchSVG(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode === 200) {
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                https.get(res.headers.location, (res2) => {
                    const chunks2 = [];
                    res2.on('data', c => chunks2.push(c));
                    res2.on('end', () => resolve(Buffer.concat(chunks2)));
                }).on('error', reject);
            } else {
                reject(new Error(`Status ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

async function main() {
    for (const b of missingBrands) {
        try {
            console.log(`Downloading ${b.slug}...`);
            const svgBuffer = await fetchSVG(`https://icon.horse/icon/${b.domain}`);
            
            // Convert to PNG using sharp
            await sharp(svgBuffer)
                .resize({ width: 400, height: 400, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .png()
                .toFile(`public/images/brands/${b.slug}.png`);
                
            console.log(`Saved ${b.slug}.png`);
        } catch (e) {
            console.log(`Error on ${b.slug}: ${e.message}`);
        }
    }
}

main();
