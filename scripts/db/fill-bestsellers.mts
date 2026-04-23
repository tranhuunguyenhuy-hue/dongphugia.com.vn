/**
 * B3: Set is_bestseller = true cho các sản phẩm flagship
 * 
 * Tiêu chí chọn:
 * - Sản phẩm TOTO, INAX, Caesar flagship (top model theo số SKU + tên)
 * - Ưu tiên: Bồn Cầu sub=1, Sen Tắm, Lavabo
 * - Dựa vào: is_featured (đã có 5 sp), brand uy tín, tên model nổi tiếng
 * 
 * Strategy đơn giản: top 3-5 sp/brand trong sub=1 có giá cao nhất (≠ 0)
 * 
 * Run: npx tsx --env-file=.env.local scripts/db/fill-bestsellers.mts [--execute]
 */
import { PrismaClient } from '@prisma/client';
const isDryRun = !process.argv.includes('--execute');
const p = new PrismaClient();

// Các model flagship đã biết — dựa vào tên + SKU phổ biến nhất Việt Nam 2024-2025
const FLAGSHIP_SKUS: string[] = [
  // TOTO Bồn Cầu flagship
  'CS320DRT3', 'CS767RT8', 'MS636DT8', 'CW822REA+',
  // INAX
  'AC-959A', 'AC-2700VN', 'AC-1035VN', 'AC-4005VN',
  // Caesar
  'CC2250', 'CF1050',
  // American Standard
  'TF-2120',
  // GROHE
  'Essence',
];

// Tên keyword cho flagship (contains)
const FLAGSHIP_KEYWORDS = [
  'tornado flush', 'washlet', 'tornado', 'cefiontect',
  'nắp điện tử', 'nắp rửa điện tử', 'smart toilet',
];

async function main() {
  console.log(`\n🚀 Phase B3: Fill is_bestseller — Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  // Strategy: top 3 by price per brand trong sub=1 (Bồn Cầu) với price > 0
  const brands = await p.brands.findMany({
    where: {
      is_active: true,
      products: { some: { is_active: true, subcategory_id: 1, price: { gt: 0 } } }
    },
    select: { id: true, name: true }
  });
  console.log(`📊 Brands trong Bồn Cầu: ${brands.map(b => b.name).join(', ')}\n`);

  const toMarkIds: number[] = [];

  for (const brand of brands) {
    // Top 3 sản phẩm giá cao nhất per brand (hàng flagship)
    const topProducts = await p.products.findMany({
      where: {
        is_active: true,
        subcategory_id: 1,
        brand_id: brand.id,
        price: { gt: 0 },
        // Không phải combo đơn giản
        NOT: { product_type: 'nap-bon-cau' }
      },
      orderBy: { price: 'desc' },
      take: 5,
      select: { id: true, name: true, sku: true, price: true }
    });

    // Thêm is_featured hiện có (không ghi đè)
    const featuredInSub = await p.products.findMany({
      where: { is_active: true, subcategory_id: 1, brand_id: brand.id, is_featured: true },
      select: { id: true }
    });

    const ids = [...new Set([
      ...topProducts.map(p => p.id),
      ...featuredInSub.map(p => p.id)
    ])];

    toMarkIds.push(...ids);

    if (topProducts.length > 0) {
      console.log(`  ${brand.name}: Top ${topProducts.length} flagship`);
      topProducts.forEach(p =>
        console.log(`    [${p.id}] ${p.name.substring(0, 55)} — ${p.price ? Number(p.price).toLocaleString('vi-VN') : 'N/A'}đ`)
      );
    }
  }

  // Unique IDs
  const uniqueIds = [...new Set(toMarkIds)];
  console.log(`\n📊 Tổng candidates: ${uniqueIds.length} sản phẩm`);

  if (!isDryRun) {
    // Reset trước
    const { count: resetCount } = await p.products.updateMany({
      where: { subcategory_id: 1, is_bestseller: true },
      data: { is_bestseller: false }
    });
    console.log(`🔄 Reset ${resetCount} sản phẩm is_bestseller = false`);

    const { count } = await p.products.updateMany({
      where: { id: { in: uniqueIds } },
      data: { is_bestseller: true }
    });
    console.log(`✅ Set is_bestseller = true cho ${count} sản phẩm`);
  } else {
    console.log(`💡 Run với --execute để mark ${uniqueIds.length} sản phẩm`);
  }
}
main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
