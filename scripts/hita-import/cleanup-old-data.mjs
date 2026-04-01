/**
 * Hita Import - Cleanup Old Data
 *
 * Deletes all rows from tbvs/bep/nuoc product + image tables before re-import.
 * Does NOT touch: gach_products, sango_products, brands, origins, product_types.
 *
 * Usage: node cleanup-old-data.mjs [--dry-run]
 * Requires: DATABASE_URL env var
 */

import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('🧹 Hita Cleanup — Delete old TBVS / BEP / NUOC data');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  const prisma = new PrismaClient();

  try {
    // Count rows before deletion
    const counts = {
      tbvs_product_images: await prisma.tbvs_product_images.count(),
      tbvs_products: await prisma.tbvs_products.count(),
      bep_product_images: await prisma.bep_product_images.count(),
      bep_products: await prisma.bep_products.count(),
      nuoc_product_images: await prisma.nuoc_product_images.count(),
      nuoc_products: await prisma.nuoc_products.count(),
    };

    console.log('📊 Current row counts:');
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table}: ${count} rows`);
    }
    console.log();

    if (dryRun) {
      console.log('🔍 DRY RUN — no rows deleted.');
      return;
    }

    // Delete in FK-safe order: images before products
    console.log('🗑️  Deleting rows...');

    const r1 = await prisma.tbvs_product_images.deleteMany({});
    console.log(`  ✅ Deleted ${r1.count} rows from tbvs_product_images`);

    const r2 = await prisma.tbvs_products.deleteMany({});
    console.log(`  ✅ Deleted ${r2.count} rows from tbvs_products`);

    const r3 = await prisma.bep_product_images.deleteMany({});
    console.log(`  ✅ Deleted ${r3.count} rows from bep_product_images`);

    const r4 = await prisma.bep_products.deleteMany({});
    console.log(`  ✅ Deleted ${r4.count} rows from bep_products`);

    const r5 = await prisma.nuoc_product_images.deleteMany({});
    console.log(`  ✅ Deleted ${r5.count} rows from nuoc_product_images`);

    const r6 = await prisma.nuoc_products.deleteMany({});
    console.log(`  ✅ Deleted ${r6.count} rows from nuoc_products`);

    console.log('\n📋 Summary:');
    console.log(`  Deleted ${r1.count} rows from tbvs_product_images`);
    console.log(`  Deleted ${r2.count} rows from tbvs_products`);
    console.log(`  Deleted ${r3.count} rows from bep_product_images`);
    console.log(`  Deleted ${r4.count} rows from bep_products`);
    console.log(`  Deleted ${r5.count} rows from nuoc_product_images`);
    console.log(`  Deleted ${r6.count} rows from nuoc_products`);
    console.log('\n✅ Cleanup complete. Ready for import.');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
