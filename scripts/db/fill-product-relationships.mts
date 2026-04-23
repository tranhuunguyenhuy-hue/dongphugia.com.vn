/**
 * C2b: Fill product_relationships từ component_skus đã parse (Phase A)
 * 
 * Với mỗi product có component_skus != '{}':
 * 1. Insert rows vào product_relationships (parent=product, child_sku=each component)
 * 2. Resolve child_id: tìm product nào có SKU match với child_sku
 * 3. Relationship type = 'component'
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const isDryRun = !process.argv.includes('--execute');

async function main() {
  console.log(`\n🚀 C2b: Fill product_relationships — Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  // Lấy sản phẩm có component_skus
  const withComponents = await p.$queryRaw<{
    id: number; name: string; sku: string; component_skus: string[]
  }[]>`
    SELECT id, name, sku, component_skus 
    FROM products 
    WHERE component_skus != '{}' AND is_active = true
    ORDER BY id
  `;
  console.log(`📦 Products with component_skus: ${withComponents.length} sp`);

  if (withComponents.length === 0) {
    console.log('⚠️  Chưa có data trong component_skus — cần chạy fix-product-names.mts --execute với Prisma type mới');
    console.log('   (component_skus field được thêm Phase A nhưng data chưa được fill vào khi chạy script cũ)');
    
    // Thử fill lại component_skus từ name patterns
    console.log('\n📊 Checking products with combo patterns in name...');
    const byName = await p.$queryRaw<{cnt: bigint}[]>`
      SELECT COUNT(*) as cnt FROM products 
      WHERE name ~ '[A-Z0-9]+-[A-Z0-9]+\+[A-Z0-9]+-[A-Z0-9]+'
        AND is_active = true
    `;
    console.log(`  Products with combo pattern in name: ${byName[0].cnt}`);
    return;
  }

  // Build SKU lookup table
  const allProducts = await p.products.findMany({
    where: { is_active: true },
    select: { id: true, sku: true }
  });
  const skuMap = new Map<string, number>();
  allProducts.forEach(p => skuMap.set(p.sku.trim().toLowerCase(), p.id));

  console.log(`📊 SKU lookup table: ${skuMap.size} products`);

  // Prepare inserts
  let insertCount = 0;
  let resolvedCount = 0;

  for (const product of withComponents) {
    for (let i = 0; i < product.component_skus.length; i++) {
      const childSku = product.component_skus[i];
      const childId = skuMap.get(childSku.trim().toLowerCase()) || null;
      if (childId) resolvedCount++;

      if (!isDryRun) {
        await p.$executeRaw`
          INSERT INTO product_relationships (parent_id, child_sku, child_id, relationship_type, sort_order)
          VALUES (${product.id}, ${childSku}, ${childId}, 'component', ${i})
          ON CONFLICT (parent_id, child_sku) DO UPDATE SET
            child_id = EXCLUDED.child_id
        `;
      }
      insertCount++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`  Total relationship records: ${insertCount}`);
  console.log(`  Resolved (child_id found): ${resolvedCount} (${Math.round(resolvedCount/insertCount*100)}%)`);
  console.log(`  Unresolved (child not in DB): ${insertCount - resolvedCount}`);

  if (!isDryRun) {
    console.log(`\n✅ Inserted ${insertCount} product_relationships`);
  } else {
    console.log(`\n💡 Run với --execute để insert ${insertCount} records`);
    // Show sample
    console.log('\n📝 Sample:');
    withComponents.slice(0, 3).forEach(p => {
      console.log(`  [${p.id}] ${p.name.substring(0, 50)}`);
      p.component_skus.forEach((sku, i) => {
        const cId = skuMap.get(sku.trim().toLowerCase());
        console.log(`    [${i}] ${sku} → child_id: ${cId || 'NOT FOUND'}`);
      });
    });
  }
}
main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
