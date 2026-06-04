import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORY_MAP } from './category-map.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, 'output');

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to Hita INAX brand page...');
  await page.goto('https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html', { waitUntil: 'domcontentloaded' });

  // Extract all links that look like category links (not absolute external links, and ending in .html)
  // Usually categories are in the sidebar or main category boxes.
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const results = [];
    for (const a of anchors) {
      try {
        const href = a.getAttribute('href');
        let path = href;
        if (href.startsWith('http')) {
          const url = new URL(href);
          if (url.hostname !== 'hita.com.vn') continue;
          path = url.pathname;
        }
        if (path && path.startsWith('/') && path.endsWith('.html')) {
          const text = (a.innerText || '').trim();
          if (text) {
            results.push({ label: text, path: path });
          }
        }
      } catch(e) {}
    }
    return results;
  });

  await browser.close();

  // Deduplicate by path
  const uniqueLinks = [];
  const seenPaths = new Set();
  for (const link of links) {
    if (!seenPaths.has(link.path)) {
      seenPaths.add(link.path);
      uniqueLinks.push(link);
    }
  }

  // Find missing in CATEGORY_MAP
  const missingCategories = [];
  
  // We want to avoid listing products as categories.
  // Generally, categories on Hita don't have very long slugs, or we can just let Tech Lead filter them out,
  // but it's better to log all missing links that are short or appear in category blocks.
  // Let's just output everything missing and we can filter manually if there are too many, or we can check if they look like products.
  
  for (const link of uniqueLinks) {
    const normalized = link.path.replace(/\/$/, '') || '/';
    if (!CATEGORY_MAP[normalized]) {
      // Exclude obvious product links (usually contain specific keywords or very long)
      // Products usually have long slugs or "combo", but let's just log all for now.
      // Wait, there might be 2400 products on the page? No, the brand page only has 20-30 products and a bunch of categories.
      missingCategories.push(link);
    }
  }

  const outputFile = path.join(OUTPUT_DIR, 'hita-categories.json');
  fs.writeFileSync(outputFile, JSON.stringify(missingCategories, null, 2));

  console.log(`\nFound ${uniqueLinks.length} total links.`);
  console.log(`Found ${missingCategories.length} links not in CATEGORY_MAP.`);
  console.log(`Saved missing links to: ${outputFile}\n`);
}

main().catch(console.error);
