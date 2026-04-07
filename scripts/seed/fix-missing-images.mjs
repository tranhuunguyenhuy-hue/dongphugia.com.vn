/**
 * LEO-386: Fix missing image_main_url for products
 * 
 * Strategy:
 * 1. Auto-promote: If product has images in product_images → use first image as main
 * 2. Placeholder: If no images at all → set placeholder
 * 3. Bonus: Fix hover images from second gallery image
 * 
 * Usage: node scripts/seed/fix-missing-images.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PLACEHOLDER_IMAGE = '/images/product-placeholder.svg';

async function main() {
  try {
    console.log('=== LEO-386: Fix missing image_main_url ===\n');

    // Step 1: Current state
    const total = await prisma.products.count();
    const missingMain = await prisma.products.count({
      where: { OR: [{ image_main_url: null }, { image_main_url: '' }] }
    });

    console.log('📊 Current state:');
    console.log(`   Total products: ${total}`);
    console.log(`   Missing image_main_url: ${missingMain}\n`);

    if (missingMain === 0) {
      console.log('✅ All products already have images. Nothing to do.');
      return;
    }

    // Step 2: Find products missing main image
    const productsNoImage = await prisma.products.findMany({
      where: { OR: [{ image_main_url: null }, { image_main_url: '' }] },
      select: {
        id: true,
        name: true,
        product_images: {
          orderBy: { sort_order: 'asc' },
          take: 2,
          select: { image_url: true }
        }
      }
    });

    let promoted = 0;
    let placeholdered = 0;
    const promoteTx = [];
    const placeholderTx = [];

    for (const p of productsNoImage) {
      if (p.product_images.length > 0) {
        // Auto-promote first gallery image
        const mainUrl = p.product_images[0].image_url;
        const hoverUrl = p.product_images[1]?.image_url || null;
        
        promoteTx.push(
          prisma.products.update({
            where: { id: p.id },
            data: {
              image_main_url: mainUrl,
              ...(hoverUrl ? { image_hover_url: hoverUrl } : {}),
              updated_at: new Date()
            }
          })
        );
        promoted++;
      } else {
        // No images at all → placeholder
        placeholderTx.push(
          prisma.products.update({
            where: { id: p.id },
            data: {
              image_main_url: PLACEHOLDER_IMAGE,
              updated_at: new Date()
            }
          })
        );
        placeholdered++;
      }
    }

    console.log(`🔄 Auto-promote: ${promoted} products (gallery → main)`);
    console.log(`🖼️  Placeholder: ${placeholdered} products (no gallery)\n`);

    // Step 3: Execute in batches
    if (promoteTx.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < promoteTx.length; i += batchSize) {
        await prisma.$transaction(promoteTx.slice(i, i + batchSize));
        console.log(`   Promoted batch ${Math.floor(i / batchSize) + 1}: ${Math.min(i + batchSize, promoteTx.length)}/${promoteTx.length}`);
      }
    }

    if (placeholderTx.length > 0) {
      await prisma.$transaction(placeholderTx);
      console.log(`   Placeholder batch: ${placeholderTx.length} products`);
    }

    // Step 4: Fix hover images for products that have main but no hover
    const missingHover = await prisma.products.findMany({
      where: {
        image_main_url: { not: null },
        OR: [{ image_hover_url: null }, { image_hover_url: '' }]
      },
      select: {
        id: true,
        image_main_url: true,
        product_images: {
          orderBy: { sort_order: 'asc' },
          select: { image_url: true }
        }
      }
    });

    let hoverFixed = 0;
    const hoverTx = [];

    for (const p of missingHover) {
      // Find a gallery image different from main
      const hoverImg = p.product_images.find(img => img.image_url !== p.image_main_url);
      if (hoverImg) {
        hoverTx.push(
          prisma.products.update({
            where: { id: p.id },
            data: { image_hover_url: hoverImg.image_url, updated_at: new Date() }
          })
        );
        hoverFixed++;
      }
    }

    if (hoverTx.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < hoverTx.length; i += batchSize) {
        await prisma.$transaction(hoverTx.slice(i, i + batchSize));
      }
      console.log(`\n✅ Fixed ${hoverFixed} hover images`);
    }

    // Step 5: Final verify
    const finalMissing = await prisma.products.count({
      where: { OR: [{ image_main_url: null }, { image_main_url: '' }] }
    });
    const hasHover = await prisma.products.count({
      where: { image_hover_url: { not: null } }
    });
    const usingPlaceholder = await prisma.products.count({
      where: { image_main_url: PLACEHOLDER_IMAGE }
    });

    console.log('\n📊 Final verification:');
    console.log(`   Has main image: ${total - finalMissing}/${total}`);
    console.log(`   Has hover image: ${hasHover}/${total}`);
    console.log(`   Using placeholder: ${usingPlaceholder}`);
    console.log(`   Still missing: ${finalMissing}`);

    console.log(`\n📈 Summary:`);
    console.log(`   Promoted from gallery: ${promoted}`);
    console.log(`   Placeholder set: ${placeholdered}`);
    console.log(`   Hover images fixed: ${hoverFixed}`);
    console.log(finalMissing === 0 ? '\n🎉 All products now have images!' : `\n⚠️ ${finalMissing} products still need attention`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
