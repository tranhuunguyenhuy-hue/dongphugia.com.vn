/**
 * LEO-384: Seed filter_definitions per subcategory
 * 
 * Architecture:
 * - Each subcategory has its own set of filters
 * - Filters read from: brand (relation), price (field), specs JSON keys
 * - Excluded specs keys: "Bảo hành" (PM decision)
 * - Common filters: Brand + Price Range (all subcategories)
 * - Specific filters: from specs JSON (per subcategory)
 * 
 * Usage: node scripts/seed/seed-filter-definitions.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Price range presets (PM approved: 6 levels)
const PRICE_PRESETS = [
  { label: 'Dưới 2 triệu', min: 0, max: 2000000 },
  { label: '2 – 5 triệu', min: 2000000, max: 5000000 },
  { label: '5 – 10 triệu', min: 5000000, max: 10000000 },
  { label: '10 – 20 triệu', min: 10000000, max: 20000000 },
  { label: '20 – 50 triệu', min: 20000000, max: 50000000 },
  { label: 'Trên 50 triệu', min: 50000000, max: null }
];

// Excluded specs keys (PM decision: skip warranty)
const EXCLUDED_KEYS = [
  'Bảo hành',
  'Thương hiệu',        // Already handled by brand relation
  'Nơi sản xuất',        // Low value as filter for most subcats
  'Kích thước (DxRxC)',  // Too variable, not useful as checkbox filter
  'Kích thước (DxR)',
  'Ưu điểm nổi bật',    // Marketing text, not filterable
  'Công nghệ',          // Too specific, not standardized
  'Tâm xả',             // Technical measurement
  'Thân kín',           // Same as Thân cầu
  'Hệ thống xả',       // Redundant with Kiểu xả
  'Đường kính lỗ bắt vòi',
  'Số lỗ bắt vòi',
  'Áp lực nước',
  'Chiều cao thân sen',
  'Kích thước bát sen',
  'Kích thước lỗ chờ',
  'Đường kính lỗ chờ',
  'Chiều dài chậu chén',
  'Kích thước cắt đá',
  'Độ dày bề mặt chậu',
  'Chiều cao đầu vòi',
  'Kích thước đầu vòi',
  'Mức gia nhiệt',
  'Nguồn điện',
  'Khối lượng',
  'Kích thước',
  'Kích thước vùng nấu',
  'Khả năng liên vùng nấu',
];

// Specific filter configs per subcategory slug
// Only include the most useful specs for filtering
const SUBCAT_FILTER_CONFIG = {
  // === TBVS ===
  'bon-cau': [
    { key: 'Kiểu xả', label: 'Kiểu xả', type: 'checkbox' },
    { key: 'Kiểu thoát', label: 'Kiểu thoát', type: 'checkbox' },
    { key: 'Loại nắp', label: 'Loại nắp', type: 'checkbox' },
    { key: 'Lượng nước xả', label: 'Lượng nước xả', type: 'checkbox' },
    { key: 'Loại thân cầu', label: 'Loại thân cầu', type: 'checkbox' },
    { key: 'Màu sắc', label: 'Màu sắc', type: 'checkbox' },
  ],
  'lavabo': [
    { key: 'Loại chậu rửa mặt', label: 'Loại chậu', type: 'checkbox' },
    { key: 'Hình dáng', label: 'Hình dáng', type: 'checkbox' },
    { key: 'Chất liệu', label: 'Chất liệu', type: 'checkbox' },
    { key: 'Lỗ xả tràn nước', label: 'Lỗ xả tràn nước', type: 'checkbox' },
  ],
  'sen-tam': [
    { key: 'Chế độ', label: 'Chế độ', type: 'checkbox' },
    { key: 'Kiểu dáng', label: 'Kiểu dáng', type: 'checkbox' },
    { key: 'Chất liệu', label: 'Chất liệu', type: 'checkbox' },
    { key: 'Thiết kế', label: 'Thiết kế', type: 'checkbox' },
  ],
  'bon-tam': [
    { key: 'Chất liệu', label: 'Chất liệu', type: 'checkbox' },
    { key: 'Tính năng bồn tắm', label: 'Tính năng', type: 'checkbox' },
    { key: 'Chiều Dài Bồn Tắm', label: 'Chiều dài', type: 'checkbox' },
    { key: 'Màu sắc', label: 'Màu sắc', type: 'checkbox' },
  ],
  'bon-tieu': [
    { key: 'Kiểu thoát', label: 'Kiểu thoát', type: 'checkbox' },
    { key: 'Vị trí lắp', label: 'Vị trí lắp', type: 'checkbox' },
    { key: 'Lượng nước xả', label: 'Lượng nước xả', type: 'checkbox' },
  ],
  'voi-chau': [
    { key: 'Lớp mạ (màu)', label: 'Màu sắc', type: 'checkbox' },
  ],
  'voi-nuoc': [
    { key: 'Chất liệu', label: 'Chất liệu', type: 'checkbox' },
    { key: 'Điều khiển', label: 'Điều khiển', type: 'checkbox' },
    { key: 'Lớp mạ (màu)', label: 'Màu sắc', type: 'checkbox' },
  ],
  'phu-kien-phong-tam': [
    { key: 'Loại Gương', label: 'Loại gương', type: 'checkbox' },
    { key: 'Kiểu Dáng Gương', label: 'Kiểu dáng', type: 'checkbox' },
    { key: 'Đèn Led', label: 'Đèn LED', type: 'checkbox' },
  ],
  'nap-bon-cau': [
    { key: 'Chất liệu', label: 'Chất liệu', type: 'checkbox' },
    { key: 'Chế Độ Rửa Cơ', label: 'Chế độ rửa', type: 'checkbox' },
  ],

  // === BEP ===
  'voi-rua-chen': [
    { key: 'Chế độ', label: 'Chế độ', type: 'checkbox' },
    { key: 'Loại vòi', label: 'Loại vòi', type: 'checkbox' },
    { key: 'Chất liệu', label: 'Chất liệu', type: 'checkbox' },
    { key: 'Lớp mạ (màu)', label: 'Màu sắc', type: 'checkbox' },
  ],
  'chau-rua-chen': [
    { key: 'Số hộc', label: 'Số hộc', type: 'checkbox' },
    { key: 'Loại hộc', label: 'Loại hộc', type: 'checkbox' },
    { key: 'Chất liệu', label: 'Chất liệu', type: 'checkbox' },
  ],
  'bep-dien-tu': [
    { key: 'Loại bếp', label: 'Loại bếp', type: 'checkbox' },
    { key: 'Số lượng vùng nấu', label: 'Số vùng nấu', type: 'checkbox' },
    { key: 'Lắp đặt', label: 'Kiểu lắp đặt', type: 'checkbox' },
  ],
  'thiet-bi-bep-khac': [],
  'may-hut-mui': [],
  'may-rua-chen': [],
  'bep-gas': [],
  'lo-nuong': [],

  // === NUOC ===
  'may-nuoc-nong': [],
  'loc-nuoc': [],
  'bon-chua-nuoc': [],
  'may-bom-nuoc': [],
};

async function collectSpecValues(subcategoryId, specKey) {
  // Collect unique values for a spec key within a subcategory
  const products = await prisma.products.findMany({
    where: { subcategory_id: subcategoryId },
    select: { specs: true }
  });

  const values = new Set();
  products.forEach(p => {
    if (p.specs && typeof p.specs === 'object' && p.specs[specKey]) {
      const val = String(p.specs[specKey]).trim();
      if (val && val !== 'null' && val !== 'undefined') {
        values.add(val);
      }
    }
  });

  return [...values].sort();
}

async function main() {
  try {
    console.log('=== LEO-384: Seed filter_definitions ===\n');

    // Step 1: Clear existing filter_definitions
    const deleted = await prisma.filter_definitions.deleteMany({});
    console.log(`🗑️  Cleared ${deleted.count} existing filter definitions\n`);

    // Step 2: Get all subcategories
    const subcategories = await prisma.subcategories.findMany({
      select: { id: true, name: true, slug: true, category_id: true },
      orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }]
    });

    let totalFilters = 0;

    for (const subcat of subcategories) {
      const productCount = await prisma.products.count({
        where: { subcategory_id: subcat.id }
      });

      if (productCount === 0) {
        console.log(`⏭️  [${subcat.name}] — 0 products, skipping`);
        continue;
      }

      console.log(`\n📂 [${subcat.name}] (${productCount} SP) — slug: "${subcat.slug}"`);

      let sortOrder = 1;

      // --- COMMON FILTER 1: Brand (always first) ---
      const brandCount = await prisma.products.groupBy({
        by: ['brand_id'],
        where: { subcategory_id: subcat.id, brand_id: { not: null } }
      });

      if (brandCount.length > 1) {
        await prisma.filter_definitions.create({
          data: {
            subcategory_id: subcat.id,
            category_id: subcat.category_id,
            filter_key: 'brand',
            filter_label: 'Thương hiệu',
            filter_type: 'checkbox_searchable',
            options: { source: 'relation', table: 'brands' },
            sort_order: sortOrder++,
            is_active: true
          }
        });
        totalFilters++;
        console.log(`   ✅ Brand filter (${brandCount.length} brands)`);
      }

      // --- COMMON FILTER 2: Price Range (always second) ---
      await prisma.filter_definitions.create({
        data: {
          subcategory_id: subcat.id,
          category_id: subcat.category_id,
          filter_key: 'price',
          filter_label: 'Khoảng giá',
          filter_type: 'range_preset',
          options: { source: 'field', presets: PRICE_PRESETS },
          sort_order: sortOrder++,
          is_active: true
        }
      });
      totalFilters++;
      console.log(`   ✅ Price range filter (6 presets)`);

      // --- SPECIFIC FILTERS from specs JSON ---
      const specFilters = SUBCAT_FILTER_CONFIG[subcat.slug] || [];

      for (const filter of specFilters) {
        const values = await collectSpecValues(subcat.id, filter.key);
        
        if (values.length <= 1) {
          console.log(`   ⏭️  ${filter.label} — only ${values.length} unique value(s), skipping`);
          continue;
        }

        await prisma.filter_definitions.create({
          data: {
            subcategory_id: subcat.id,
            category_id: subcat.category_id,
            filter_key: filter.key,
            filter_label: filter.label,
            filter_type: filter.type,
            options: { source: 'specs', values: values },
            sort_order: sortOrder++,
            is_active: true
          }
        });
        totalFilters++;
        console.log(`   ✅ ${filter.label} (${values.length} values): ${values.slice(0, 5).join(', ')}${values.length > 5 ? '...' : ''}`);
      }
    }

    // Step 3: Final verification
    const finalCount = await prisma.filter_definitions.count();
    const bySubcat = await prisma.filter_definitions.groupBy({
      by: ['subcategory_id'],
      _count: true
    });

    console.log(`\n\n📊 Final Summary:`);
    console.log(`   Total filter definitions: ${finalCount}`);
    console.log(`   Subcategories with filters: ${bySubcat.length}`);
    console.log(`   Average filters per subcategory: ${(finalCount / bySubcat.length).toFixed(1)}`);

    // Show breakdown
    console.log(`\n📋 Breakdown by subcategory:`);
    for (const group of bySubcat) {
      const subcat = subcategories.find(s => s.id === group.subcategory_id);
      console.log(`   ${subcat?.name || 'Unknown'}: ${group._count} filters`);
    }

    console.log('\n🎉 Done! Filter definitions seeded successfully.');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
