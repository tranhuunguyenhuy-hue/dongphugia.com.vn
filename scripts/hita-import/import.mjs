/**
 * Hita Import Script — LEO-321
 * Import TBVS / BEP / NUOC products from hita-crawled JSON files into DB.
 *
 * Usage:
 *   node import.mjs [--dry-run]
 *   node import.mjs --category tbvs   # only import TBVS
 *   node import.mjs --category bep    # only import BEP
 *   node import.mjs --category nuoc   # only import NUOC
 *
 * Requires: DATABASE_URL env var (Supabase pooler with ?pgbouncer=true)
 *
 * Input files (relative to this script):
 *   tbvs-hita.json, bep-hita.json, nuoc-hita.json
 *
 * Idempotent: upserts by slug for lookup tables, skips products by SKU.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ----- CLI args -----
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const categoryArg = (() => {
  const idx = args.indexOf('--category');
  return idx !== -1 ? args[idx + 1]?.toLowerCase() : null;
})();

// ----- Helpers -----
function slugify(text) {
  return (text || '')
    .toString().toLowerCase()
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// Normalize brand names from ALL CAPS to proper case where needed
const BRAND_NAME_MAP = {
  'TOTO': 'TOTO',
  'INAX': 'INAX',
  'PANASONIC': 'Panasonic',
  'GROHE': 'Grohe',
  'HANSGROHE': 'Hansgrohe',
  'LUXTA': 'Luxta',
  'KAFF': 'KAFF',
  'RHEEM': 'Rheem',
  'ARISTON': 'Ariston',
  'FERROLI': 'Ferroli',
  'ATMOR': 'Atmor',
  'ELICA': 'Elica',
  'TEKA': 'Teka',
  'JOMOO': 'Jomoo',
  'DURAVIT': 'Duravit',
  'PLATINUM': 'Platinum',
  'MOEN': 'Moen',
  'KOHLER': 'Kohler',
  'AMERICAN STANDARD': 'American Standard',
  'SAMSUNG': 'Samsung',
  'MITSUBISHI CLEANSUI': 'Mitsubishi Cleansui',
  'COWAY': 'Coway',
  'PHILIPS': 'Philips',
  'UNILEVER PUREIT': 'Unilever Pureit',
  'KAROFI': 'Karofi',
  'KLUGER': 'Kluger',
  'ESSLINGER': 'Esslinger',
  'CAESAR': 'Caesar',
  'COTTO': 'Cotto',
  'HITA': 'Hita',
  'NANOCO': 'Nanoco',
};

function normalizeBrand(raw) {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  return BRAND_NAME_MAP[upper] || raw.trim();
}

// Brand → origin country mapping
const BRAND_ORIGIN_MAP = {
  'TOTO': 'Nhật Bản',
  'INAX': 'Nhật Bản',
  'Panasonic': 'Nhật Bản',
  'Mitsubishi Cleansui': 'Nhật Bản',
  'Grohe': 'Đức',
  'Hansgrohe': 'Đức',
  'Esslinger': 'Đức',
  'Duravit': 'Đức',
  'Luxta': 'Hàn Quốc',
  'Samsung': 'Hàn Quốc',
  'Coway': 'Hàn Quốc',
  'KAFF': 'Việt Nam',
  'Hita': 'Việt Nam',
  'Karofi': 'Việt Nam',
  'Platinum': 'Việt Nam',
  'Elica': 'Ý',
  'Ariston': 'Ý',
  'Ferroli': 'Ý',
  'Teka': 'Tây Ban Nha',
  'Moen': 'Mỹ',
  'Kohler': 'Mỹ',
  'American Standard': 'Mỹ',
  'Rheem': 'Mỹ',
  'Atmor': 'Israel',
  'Philips': 'Hà Lan',
  'Unilever Pureit': 'Anh',
  'Jomoo': 'Trung Quốc',
  'Caesar': 'Đài Loan',
  'Cotto': 'Thái Lan',
  'Kluger': 'Úc',
};

// ----- Category configs -----
const CATEGORIES = {
  tbvs: {
    label: 'TBVS',
    inputFile: path.join(__dirname, 'tbvs-hita.json'),
    categoryId: 2,
    brandModel: 'tbvs_brands',
    typeModel: 'tbvs_product_types',
    productModel: 'tbvs_products',
    imageModel: 'tbvs_product_images',
  },
  bep: {
    label: 'BEP',
    inputFile: path.join(__dirname, 'bep-hita.json'),
    categoryId: 3,
    brandModel: 'bep_brands',
    typeModel: 'bep_product_types',
    productModel: 'bep_products',
    imageModel: 'bep_product_images',
  },
  nuoc: {
    label: 'NUOC',
    inputFile: path.join(__dirname, 'nuoc-hita.json'),
    categoryId: 5,
    brandModel: 'nuoc_brands',
    typeModel: 'nuoc_product_types',
    productModel: 'nuoc_products',
    imageModel: 'nuoc_product_images',
  },
};

// ----- Per-category import -----
async function importCategory(prisma, catKey, config, dryRun) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Category: ${config.label}`);
  console.log('='.repeat(60));

  const products = JSON.parse(readFileSync(config.inputFile, 'utf-8'));
  console.log(`  Loaded ${products.length} products from ${path.basename(config.inputFile)}`);

  if (dryRun) {
    const brands = [...new Set(products.map(p => normalizeBrand(p.brand)).filter(Boolean))];
    const types = [...new Set(products.map(p => p.product_type_name).filter(Boolean))];
    console.log('\n  📊 DRY RUN:');
    console.log(`    Products: ${products.length}`);
    console.log(`    Brands (${brands.length}): ${brands.slice(0, 12).join(', ')}${brands.length > 12 ? '...' : ''}`);
    console.log(`    Types (${types.length}): ${types.join(', ')}`);
    const skus = products.map(p => p.sku);
    const dupes = skus.filter((s, i) => skus.indexOf(s) !== i);
    if (dupes.length) {
      console.log(`    ⚠️  Duplicate SKUs in JSON: ${[...new Set(dupes)].length}`);
    } else {
      console.log(`    ✅ No duplicate SKUs in JSON`);
    }
    return { imported: 0, skipped: 0, failed: 0, total: products.length };
  }

  // Step 1: Upsert brands
  console.log('\n  📝 Step 1: Upsert brands...');
  const brandMap = new Map(); // rawBrandStr → DB id
  const uniqueRawBrands = [...new Set(products.map(p => p.brand).filter(Boolean))];
  for (const rawBrand of uniqueRawBrands) {
    const displayName = normalizeBrand(rawBrand);
    const slug = slugify(displayName);
    try {
      const brand = await prisma[config.brandModel].upsert({
        where: { slug },
        update: {},
        create: {
          name: displayName,
          slug,
          origin_country: BRAND_ORIGIN_MAP[displayName] || null,
          is_active: true,
        },
      });
      brandMap.set(rawBrand, brand.id);
    } catch (e) {
      console.log(`    ⚠️  Brand upsert failed for "${displayName}": ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`    ✅ ${brandMap.size} brands ready`);

  // Step 2: Upsert product types
  console.log('\n  📝 Step 2: Upsert product types...');
  const typeMap = new Map(); // product_type_slug → DB id
  const typesSeen = new Map();
  for (const p of products) {
    if (p.product_type_slug && !typesSeen.has(p.product_type_slug)) {
      typesSeen.set(p.product_type_slug, p.product_type_name);
    }
  }
  for (const [slug, name] of typesSeen.entries()) {
    try {
      const type = await prisma[config.typeModel].upsert({
        where: { slug },
        update: {},
        create: {
          name,
          slug,
          category_id: config.categoryId,
          is_active: true,
        },
      });
      typeMap.set(slug, type.id);
    } catch (e) {
      console.log(`    ⚠️  Type upsert failed for "${slug}": ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`    ✅ ${typeMap.size} product types ready`);

  // Step 3: Import products
  console.log(`\n  📝 Step 3: Importing ${products.length} products...`);
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let failedLog = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];

    if (i % 200 === 0 && i > 0) {
      console.log(`    [${i}/${products.length}] imported=${imported} skipped=${skipped} failed=${failed}`);
    }

    try {
      // Skip if SKU already in DB (idempotency)
      const existing = await prisma[config.productModel].findUnique({
        where: { sku: p.sku },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Build unique slug
      let baseSlug = slugify(p.name).substring(0, 185);
      if (!baseSlug) baseSlug = slugify(p.sku);
      let slug = baseSlug;
      const slugConflict = await prisma[config.productModel].findUnique({
        where: { slug },
        select: { id: true },
      });
      if (slugConflict) {
        const skuPart = p.sku.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
        slug = `${baseSlug}-${skuPart}`.substring(0, 200);
      }

      const typeId = typeMap.get(p.product_type_slug);
      if (!typeId) {
        failedLog.push(`No type for slug "${p.product_type_slug}" — SKU ${p.sku}`);
        failed++;
        continue;
      }

      const displayBrand = normalizeBrand(p.brand);
      const seoDesc = `${p.name} chính hãng${displayBrand ? ` ${displayBrand}` : ''}. Giá tốt nhất tại Đông Phú Gia, Đà Lạt.`.substring(0, 500);

      const productData = {
        sku: p.sku.substring(0, 50),
        name: p.name.substring(0, 200),
        slug: slug.substring(0, 200),
        product_type_id: typeId,
        brand_id: p.brand ? (brandMap.get(p.brand) || null) : null,
        description: p.description || null,
        price: p.price ? Math.round(p.price) : null,
        price_display: p.price ? null : 'Liên hệ báo giá',
        image_main_url: p.image_main_url || null,
        is_active: true,
        is_new: true,
        stock_status: p.stock_status || 'in_stock',
        seo_title: p.name.substring(0, 200),
        seo_description: seoDesc,
      };

      await prisma[config.productModel].create({ data: productData });
      imported++;
    } catch (e) {
      failed++;
      if (failedLog.length < 20) {
        failedLog.push(`SKU ${p.sku}: ${e.message.substring(0, 100)}`);
      }
    }
  }

  console.log(`    [${products.length}/${products.length}] done`);

  if (failedLog.length > 0) {
    console.log('\n  ⚠️  Failed details (first 20):');
    for (const msg of failedLog) {
      console.log(`    - ${msg}`);
    }
  }

  return { imported, skipped, failed, total: products.length };
}

// ----- Entry point -----
async function main() {
  console.log('🚀 Hita Import Script — LEO-321');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  if (categoryArg) console.log(`   Category filter: ${categoryArg}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL not set. Aborting.');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const results = {};

    for (const [catKey, config] of Object.entries(CATEGORIES)) {
      if (categoryArg && categoryArg !== catKey) continue;
      results[catKey] = await importCategory(prisma, catKey, config, dryRun);
    }

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    let totalImported = 0, totalSkipped = 0, totalFailed = 0, totalTotal = 0;
    for (const [cat, r] of Object.entries(results)) {
      const label = CATEGORIES[cat].label;
      console.log(`  ${label}: ${r.imported} imported, ${r.skipped} skipped, ${r.failed} failed / ${r.total} total`);
      totalImported += r.imported;
      totalSkipped += r.skipped;
      totalFailed += r.failed;
      totalTotal += r.total;
    }
    console.log('─'.repeat(60));
    console.log(`  TOTAL: ${totalImported} imported, ${totalSkipped} skipped, ${totalFailed} failed / ${totalTotal} total`);
    console.log('='.repeat(60));

    if (!dryRun && totalFailed > 0) {
      console.log(`\n⚠️  ${totalFailed} products failed to import.`);
    }
    if (!dryRun) {
      console.log('\n✅ Import complete!');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
