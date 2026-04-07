/**
 * LEO-385: Auto-generate price_display for products
 * 
 * Logic:
 * - price > 0 → format to "#,###đ" (e.g. "3,060,000đ")
 * - price = 0 OR null → "Liên hệ báo giá"
 * 
 * Usage: node scripts/seed/generate-price-display.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function formatPrice(price) {
  if (!price) return 'Liên hệ báo giá';
  const num = parseFloat(price.toString());
  if (num <= 0) return 'Liên hệ báo giá';
  return num.toLocaleString('vi-VN') + 'đ';
}

async function main() {
  try {
    console.log('=== LEO-385: Generate price_display ===\n');

    // Step 1: Check current state
    const total = await prisma.products.count();
    const missingDisplay = await prisma.products.count({
      where: { OR: [{ price_display: null }, { price_display: '' }] }
    });
    const hasPrice = await prisma.products.count({
      where: { price: { gt: 0 } }
    });

    console.log('📊 Current state:');
    console.log(`   Total products: ${total}`);
    console.log(`   Missing price_display: ${missingDisplay}`);
    console.log(`   Has price > 0: ${hasPrice}`);
    console.log(`   No price (null/0): ${total - hasPrice}\n`);

    // Step 2: Fetch products needing update
    const products = await prisma.products.findMany({
      where: { OR: [{ price_display: null }, { price_display: '' }] },
      select: { id: true, name: true, price: true }
    });

    if (products.length === 0) {
      console.log('✅ All products already have price_display. Nothing to do.');
      return;
    }

    // Preview 5 samples
    console.log('🔍 Sample before update:');
    products.slice(0, 5).forEach(s => {
      const newDisplay = formatPrice(s.price);
      console.log(`   [${s.id}] ${s.name.substring(0, 40)}... | price: ${s.price} → "${newDisplay}"`);
    });
    console.log('');

    // Step 3: Batch update
    console.log(`⚙️  Updating ${products.length} products...\n`);
    let formattedCount = 0;
    let contactCount = 0;

    const batchSize = 200;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const updates = batch.map(p => {
        const display = formatPrice(p.price);
        if (display === 'Liên hệ báo giá') contactCount++;
        else formattedCount++;
        
        return prisma.products.update({
          where: { id: p.id },
          data: { price_display: display, updated_at: new Date() }
        });
      });
      
      await prisma.$transaction(updates);
      console.log(`   Batch ${Math.floor(i / batchSize) + 1}: updated ${Math.min(i + batchSize, products.length)}/${products.length}`);
    }

    console.log('\n✅ Done!');
    console.log(`   Formatted price (e.g. "3,060,000đ"): ${formattedCount}`);
    console.log(`   "Liên hệ báo giá": ${contactCount}`);

    // Step 4: Verify
    const remaining = await prisma.products.count({
      where: { OR: [{ price_display: null }, { price_display: '' }] }
    });
    console.log(`\n📊 Verification: ${remaining === 0 ? '✅ ALL GOOD' : `⚠️ ${remaining} still missing`}`);

    // Show sample results
    const samples = await prisma.products.findMany({
      where: { price: { gt: 0 } },
      select: { name: true, price: true, price_display: true },
      take: 5
    });
    console.log('\n🔍 Sample results:');
    samples.forEach(s => {
      console.log(`   ${s.name.substring(0, 40)}... → "${s.price_display}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
