/**
 * TDM Import Script - Seed scraped TBVS products into Prisma DB
 * 
 * Usage: node import-tbvs.mjs [--input ./data/tbvs-all.json] [--dry-run]
 * 
 * Requires: DATABASE_URL env var pointing to Supabase PostgreSQL
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

// CLI args
const args = process.argv.slice(2);
const getCLIArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const inputFile = getCLIArg('--input') || new URL('./tbvs-clean.json', import.meta.url).pathname;
const dryRun = args.includes('--dry-run');

function slugify(text) {
  return text
    .toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

async function main() {
  console.log('🚀 TDM Import Script');
  console.log(`   Input: ${inputFile}`);
  console.log(`   Dry run: ${dryRun}\n`);

  // Load scraped data
  const products = JSON.parse(readFileSync(inputFile, 'utf-8'));
  console.log(`📦 Loaded ${products.length} products\n`);

  if (dryRun) {
    // Just analyze and print summary
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
    const origins = [...new Set(products.map(p => p.origin).filter(Boolean))];
    const colors = [...new Set(products.map(p => p.color).filter(Boolean))];
    const types = [...new Set(products.map(p => p.typeName).filter(Boolean))];
    const subtypes = [...new Set(products.map(p => p.subtype).filter(Boolean))];
    
    console.log('📊 DRY RUN ANALYSIS:');
    console.log(`  Products: ${products.length}`);
    console.log(`  Brands (${brands.length}): ${brands.join(', ')}`);
    console.log(`  Origins (${origins.length}): ${origins.join(', ')}`);
    console.log(`  Colors (${colors.length}): ${colors.join(', ')}`);
    console.log(`  Types (${types.length}): ${types.join(', ')}`);
    console.log(`  Subtypes (${subtypes.length}): ${subtypes.join(', ')}`);
    
    // Check for SKU duplicates
    const skus = products.map(p => p.sku);
    const dupes = skus.filter((s, i) => skus.indexOf(s) !== i);
    if (dupes.length) {
      console.log(`\n  ⚠️ Duplicate SKUs (${dupes.length}): ${[...new Set(dupes)].join(', ')}`);
    } else {
      console.log(`\n  ✅ No duplicate SKUs`);
    }
    
    return;
  }

  // Connect to DB
  const prisma = new PrismaClient();
  
  try {
    // Step 1: Ensure lookup tables exist
    console.log('📝 Step 1: Creating/updating lookup tables...');
    
    // Brands
    const brandMap = new Map();
    const uniqueBrands = [...new Set(products.map(p => p.brand).filter(Boolean))];
    for (const brandName of uniqueBrands) {
      const slug = slugify(brandName);
      const brand = await prisma.tbvs_brands.upsert({
        where: { slug },
        update: {},
        create: {
          name: brandName,
          slug,
          origin_country: brandName === 'INAX' ? 'Nhật Bản' : 
                          brandName === 'TOTO' ? 'Nhật Bản' :
                          brandName === 'Caesar' ? 'Đài Loan' :
                          brandName === 'Grohe' ? 'Đức' :
                          brandName === 'Kohler' ? 'Mỹ' :
                          brandName === 'American Standard' ? 'Mỹ' :
                          brandName === 'Viglacera' ? 'Việt Nam' :
                          brandName === 'Cotto' ? 'Thái Lan' :
                          null,
          is_active: true,
        }
      });
      brandMap.set(brandName, brand.id);
      console.log(`  ✅ Brand: ${brandName} (ID: ${brand.id})`);
    }
    
    // Origins
    const originMap = new Map();
    const uniqueOrigins = [...new Set(products.map(p => p.origin).filter(Boolean))];
    for (const originName of uniqueOrigins) {
      const slug = slugify(originName);
      const origin = await prisma.origins.upsert({
        where: { slug },
        update: {},
        create: { name: originName, slug }
      });
      originMap.set(originName, origin.id);
      console.log(`  ✅ Origin: ${originName} (ID: ${origin.id})`);
    }
    
    // Colors
    const colorMap = new Map();
    const uniqueColors = [...new Set(products.map(p => p.color).filter(Boolean))];
    for (const colorName of uniqueColors) {
      const slug = slugify(colorName);
      let color;
      try {
        color = await prisma.colors.upsert({
          where: { slug },
          update: {},
          create: { name: colorName, slug }
        });
      } catch {
        color = await prisma.colors.findFirst({ where: { slug } });
      }
      if (color) colorMap.set(colorName, color.id);
      console.log(`  ✅ Color: ${colorName} (ID: ${color?.id})`);
    }
    
    // Product Types
    const typeMap = new Map();
    const uniqueTypes = [...new Set(products.map(p => JSON.stringify({ slug: p.typeSlug, name: p.typeName })))];
    for (const typeStr of uniqueTypes) {
      const { slug, name } = JSON.parse(typeStr);
      let type;
      try {
        type = await prisma.tbvs_product_types.upsert({
          where: { slug },
          update: {},
          create: {
            name,
            slug,
            category_id: 2, // TBVS category
            is_active: true,
          }
        });
      } catch {
        type = await prisma.tbvs_product_types.findFirst({ where: { slug } });
      }
      if (type) typeMap.set(slug, type.id);
      console.log(`  ✅ Type: ${name} (ID: ${type?.id})`);
    }
    
    // Subtypes
    const subtypeMap = new Map();
    const uniqueSubtypes = [...new Set(products.filter(p => p.subtype).map(p => JSON.stringify({ name: p.subtype, typeSlug: p.typeSlug })))];
    for (const stStr of uniqueSubtypes) {
      const { name, typeSlug } = JSON.parse(stStr);
      const slug = slugify(name);
      const typeId = typeMap.get(typeSlug);
      if (!typeId) continue;
      
      let subtype;
      try {
        subtype = await prisma.tbvs_subtypes.upsert({
          where: { slug },
          update: {},
          create: {
            name,
            slug,
            product_type_id: typeId,
            is_active: true,
          }
        });
      } catch {
        subtype = await prisma.tbvs_subtypes.findFirst({ where: { slug } });
      }
      if (subtype) subtypeMap.set(name, subtype.id);
      console.log(`  ✅ Subtype: ${name} (ID: ${subtype?.id})`);
    }
    
    // Step 2: Import products
    console.log(`\n📝 Step 2: Importing ${products.length} products...`);
    
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      process.stdout.write(`  [${i + 1}/${products.length}] ${p.name.substring(0, 50)}...`);
      
      try {
        // Check if SKU already exists
        const existing = await prisma.tbvs_products.findUnique({ where: { sku: p.sku } });
        if (existing) {
          skipped++;
          process.stdout.write(' ⏭️ (exists)\n');
          continue;
        }
        
        // Also check slug
        const existingSlug = await prisma.tbvs_products.findUnique({ where: { slug: p.slug } });
        const slug = existingSlug ? `${p.slug}-${Date.now()}` : p.slug;
        
        // Create product
        const product = await prisma.tbvs_products.create({
          data: {
            sku: p.sku,
            name: p.name,
            slug: slug.substring(0, 200),
            product_type_id: typeMap.get(p.typeSlug) || 1,
            subtype_id: p.subtype ? subtypeMap.get(p.subtype) || null : null,
            brand_id: p.brand ? brandMap.get(p.brand) || null : null,
            color_id: p.color ? colorMap.get(p.color) || null : null,
            origin_id: p.origin ? originMap.get(p.origin) || null : null,
            description: p.description || null,
            features: p.features || null,
            specifications: p.specifications || {},
            warranty_months: 12,
            price: null, // User will set prices manually
            price_display: 'Liên hệ báo giá',
            image_main_url: p.images?.[0] || null,
            image_hover_url: p.images?.[1] || null,
            is_active: true,
            is_new: true,
            stock_status: 'in_stock',
            seo_title: p.name.substring(0, 200),
            seo_description: `${p.name} chính hãng${p.brand ? ` ${p.brand}` : ''}. Giá tốt nhất tại Đông Phú Gia, Đà Lạt.`.substring(0, 500),
          }
        });
        
        // Add additional images
        if (p.images && p.images.length > 1) {
          const imageRecords = p.images.slice(0, 6).map((url, idx) => ({
            product_id: product.id,
            image_url: url,
            alt_text: `${p.name} - Ảnh ${idx + 1}`,
            sort_order: idx,
          }));
          
          await prisma.tbvs_product_images.createMany({
            data: imageRecords,
          });
        }
        
        imported++;
        process.stdout.write(' ✅\n');
      } catch (e) {
        failed++;
        process.stdout.write(` ❌ ${e.message.substring(0, 80)}\n`);
      }
    }
    
    // Summary
    console.log('\n📊 IMPORT SUMMARY:');
    console.log('─'.repeat(50));
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total: ${products.length}`);
    console.log('─'.repeat(50));
    
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
