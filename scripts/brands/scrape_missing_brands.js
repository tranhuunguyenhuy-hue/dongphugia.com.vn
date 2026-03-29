const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const http = require('http');

const missingBrands = [
  { slug: 'grohe', url: 'https://www.tdm.vn/thuong-hieu/grohe' },
  { slug: 'teka', url: 'https://www.tdm.vn/thuong-hieu/teka' },
  { slug: 'malloca', url: 'https://www.tdm.vn/thuong-hieu/malloca' },
  { slug: 'electrolux', url: 'https://www.tdm.vn/thuong-hieu/electrolux' },
  { slug: 'siemens', url: 'https://www.tdm.vn/siemens' }, // Some might be directly /siemens or /thuong-hieu/siemens
  { slug: 'faster', url: 'https://www.tdm.vn/thuong-hieu/faster' },
  { slug: 'canzy', url: 'https://www.tdm.vn/thuong-hieu/canzy' },
  { slug: 'giovani', url: 'https://www.tdm.vn/thuong-hieu/giovani' },
  { slug: 'dai-thanh', url: 'https://www.tdm.vn/thuong-hieu/dai-thanh' },
  { slug: 'son-ha', url: 'https://www.tdm.vn/thuong-hieu/son-ha' },
  { slug: 'ferroli', url: 'https://www.tdm.vn/thuong-hieu/ferroli' },
  { slug: 'ariston', url: 'https://www.tdm.vn/thuong-hieu/ariston' },
  { slug: 'kangaroo', url: 'https://www.tdm.vn/thuong-hieu/kangaroo' },
  { slug: 'sunhouse', url: 'https://www.tdm.vn/thuong-hieu/sunhouse' },
  { slug: 'midea', url: 'https://www.tdm.vn/thuong-hieu/midea' }
];

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else {
        resolve(false);
      }
    }).on('error', (err) => resolve(false));
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  for (const b of missingBrands) {
    try {
      console.log(`Checking ${b.url}...`);
      await page.goto(b.url, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Look for the logo in the breadcrumb area or brand description
      // TDM usually has a brand logo near the top of the brand page: img.img-responsive inside .brand-info or .brand-logo
      const logoUrl = await page.evaluate(() => {
        // Find any image inside a div handling brand presentation
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
           if (img.src.toLowerCase().includes(b.slug) || img.src.toLowerCase().includes('brand') || img.src.toLowerCase().includes('thuonghieu')) {
             if (img.src.includes('.png') || img.src.includes('.jpg') || img.src.includes('.webp') || img.src.includes('.svg')) {
               return img.src;
             }
           }
        }
        return null;
      });

      if (logoUrl) {
         console.log(`Found logo for ${b.slug}: ${logoUrl}`);
         // Determine extension
         const extMatch = logoUrl.match(/\.(png|jpg|jpeg|webp|svg)/i);
         let ext = '.png';
         if (extMatch) ext = `.${extMatch[1].toLowerCase()}`;
         if (ext === '.jpeg') ext = '.jpg';
         
         await downloadImage(logoUrl, `public/images/brands/${b.slug}${ext}`);
      } else {
         console.log(`Could not find logo for ${b.slug}`);
      }
    } catch (err) {
      console.log(`Error on ${b.slug}: ${err.message}`);
    }
  }

  await browser.close();
})();
