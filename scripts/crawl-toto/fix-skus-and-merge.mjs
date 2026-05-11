import { PrismaClient } from '@prisma/client';
import https from 'https';
import fs from 'fs';

const prisma = new PrismaClient();

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractSkuFromHtml(html) {
  if (!html) return null;
  const regex = /<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      if (json['@type'] === 'Product' && json.sku) return json.sku;
      if (json['@graph']) {
        const p = json['@graph'].find(i => i['@type'] === 'Product');
        if (p && p.sku) return p.sku;
      }
    } catch (e) {}
  }
  const skuMatch = html.match(/\"sku\"\s*:\s*\"([^\"]+)\"/i);
  if (skuMatch) return skuMatch[1];
  return null;
}

async function main() {
  console.log('Fetching official SKUs and resolving duplicates...');
  
  // 1. Get all NEW products (created after 2026-05-05T19:40:00Z)
  const newProducts = await prisma.products.findMany({
    where: { brand_id: 1, created_at: { gte: new Date('2026-05-05T19:40:00Z') } },
    select: { id: true, sku: true, source_url: true, name: true, price: true, original_price: true }
  });
  
  console.log(`Found ${newProducts.length} newly imported products.`);
  
  // 2. We also have old products
  const oldProducts = await prisma.products.findMany({
    where: { brand_id: 1, created_at: { lt: new Date('2026-05-05T19:40:00Z') } },
    select: { id: true, sku: true, name: true }
  });
  console.log(`Found ${oldProducts.length} old products.`);
  
  const hitaSkusCache = {};
  if (fs.existsSync('scripts/crawl-toto/output/hita-skus.json')) {
    Object.assign(hitaSkusCache, JSON.parse(fs.readFileSync('scripts/crawl-toto/output/hita-skus.json', 'utf8')));
  }

  let mergedCount = 0;
  let updatedCount = 0;
  
  for (let i = 0; i < newProducts.length; i++) {
    const p = newProducts[i];
    if (!p.source_url) continue;
    
    let officialSku = hitaSkusCache[p.source_url];
    
    if (!officialSku) {
      process.stdout.write(`[${i+1}/${newProducts.length}] Fetching SKU for ${p.source_url}... `);
      const html = await fetchHtml(p.source_url);
      officialSku = extractSkuFromHtml(html);
      
      if (officialSku) {
         hitaSkusCache[p.source_url] = officialSku;
         fs.writeFileSync('scripts/crawl-toto/output/hita-skus.json', JSON.stringify(hitaSkusCache, null, 2));
         console.log(officialSku);
      } else {
         console.log('NOT FOUND');
      }
      await new Promise(r => setTimeout(r, 100)); // be nice to the server
    }
    
    // Now we have the official SKU, let's see if there is an OLD product with this exact SKU
    if (officialSku) {
      const oldMatch = oldProducts.find(old => old.sku === officialSku || old.sku === officialSku + '#XW' || old.sku === officialSku + '#W' || old.sku.startsWith(officialSku + '#'));
      
      if (oldMatch) {
        // DUPLICATE DETECTED!
        // We should merge new product data into old product, and DELETE the new product
        console.log(`\nDUPLICATE MERGE: New ID ${p.id} matches Old ID ${oldMatch.id} (SKU: ${oldMatch.sku})`);
        
        // Update old product with new prices and source url
        await prisma.products.update({
          where: { id: oldMatch.id },
          data: {
            price: p.price,
            original_price: p.original_price,
            source_url: p.source_url,
            // Don't change name or sku of the old product as it might break things, or maybe update name to be better?
            // Keep old name for safety, but update the source url so it links properly
          }
        });
        
        // Delete the new duplicate product
        await prisma.products.delete({ where: { id: p.id } });
        mergedCount++;
      } else {
        // It's a genuinely new product, just update its SKU to the official one
        // Wait, what if another new product already got updated to this SKU?
        try {
          await prisma.products.update({
            where: { id: p.id },
            data: { sku: officialSku }
          });
          updatedCount++;
        } catch (e) {
          if (e.code === 'P2002') { // Unique constraint
            console.log(`\nSKU CONFLICT: ${officialSku} already exists in DB! (Cannot update ID ${p.id})`);
          } else {
            console.error('\nError updating SKU:', e.message);
          }
        }
      }
    }
  }
  
  console.log('\n--- SUMMARY ---');
  console.log(`Merged (Deleted new, kept old): ${mergedCount}`);
  console.log(`Updated SKUs for new products:  ${updatedCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
