#!/usr/bin/env node

/**
 * Export Products to CSV
 * 
 * Exports all products sorted by:
 *   Category L1 > Category L2 > Brand > Family Group (variant_group or SKU prefix)
 * 
 * Output:
 *   exports/all-products.csv       — All products in one file
 *   exports/by-brand/<brand>.csv   — Separate file per brand
 *   exports/summary.csv            — Summary counts by category & brand
 * 
 * Usage: node scripts/export-products.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// ─── CSV UTILITIES ───────────────────────────────────────────────────────────

const BOM = '\uFEFF'; // UTF-8 BOM for Excel Vietnamese compatibility

/**
 * Escape a CSV field value.
 * Wraps in double quotes if it contains comma, double-quote, or newline.
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Format a Decimal/number as Vietnamese price string (e.g., 1,200,000).
 */
function formatPrice(value) {
  if (value === null || value === undefined) return '';
  const num = Number(value);
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('vi-VN');
}

/**
 * Write rows to a CSV file with BOM header.
 */
function writeCSV(filePath, headers, rows) {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));
  const content = BOM + headerLine + '\n' + dataLines.join('\n') + '\n';
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ─── PRODUCT TYPE → READABLE NAME MAPPING ────────────────────────────────────

const PRODUCT_TYPE_LABELS = {
  'sen-tam-nong-lanh': 'Sen tắm nóng lạnh',
  'bon-cau-1-khoi': 'Bồn cầu 1 khối',
  'lavabo-dat-ban': 'Lavabo đặt bàn',
  'voi-nong-lanh': 'Vòi nóng lạnh',
  'bon-cau-2-khoi': 'Bồn cầu 2 khối',
  'phu-kien': 'Phụ kiện',
  'cu-sen': 'Củ sen',
  'bon-tam': 'Bồn tắm',
  'bon-cau-treo-tuong': 'Bồn cầu treo tường',
  'tay-sen': 'Tay sen',
  'sen-dung': 'Sen đứng',
  'sen-tam-nhiet-do': 'Sen tắm nhiệt độ',
  'sen-tam-am-tuong': 'Sen tắm âm tường',
  'lavabo-treo-tuong': 'Lavabo treo tường',
  'phu-kien-voi': 'Phụ kiện vòi',
  'sen-am-tuong': 'Sen âm tường',
  'bon-tam-xay': 'Bồn tắm xây',
  'lavabo-am-ban': 'Lavabo âm bàn',
  'phu-kien-sen-tam': 'Phụ kiện sen tắm',
  'nap-thuong-dong-em': 'Nắp thường đóng êm',
  'phu-kien-bon-cau': 'Phụ kiện bồn cầu',
  'bon-tam-massage': 'Bồn tắm massage',
  'voi-cam-ung': 'Vòi cảm ứng',
  'sen-cay': 'Sen cây',
  'duong-vanh': 'Dương vành',
  'cu-sen-van-sen': 'Củ sen & van sen',
  'bon-tam-dat-san': 'Bồn tắm đặt sàn',
  'voi-co-trung': 'Vòi cổ trung',
  'voi-xa-bon-tam': 'Vòi xả bồn tắm',
  'lavabo': 'Lavabo',
  'bat-sen-cam-tay': 'Bát sen cầm tay',
  'lavabo-ban-am': 'Lavabo bàn âm',
  'nap-dien-tu': 'Nắp điện tử',
  'bon-cau-thong-minh': 'Bồn cầu thông minh',
  'phu-kien-phong-tam': 'Phụ kiện phòng tắm',
  'bon-tam-co-yem': 'Bồn tắm có yếm',
  'than-bon-cau': 'Thân bồn cầu',
  'bon-tieu-nam': 'Bồn tiểu nam',
  'treo-khan': 'Treo khăn',
  'ket-nuoc': 'Két nước',
  'phu-kien-bon-tieu': 'Phụ kiện bồn tiểu',
  'tu-chau': 'Tủ chậu',
  'voi-gan-tuong': 'Vòi gắn tường',
  'nap-rua-co': 'Nắp rửa cơ',
  'bon-cau-dat-san': 'Bồn cầu đặt sàn',
  'bat-sen-tran': 'Bát sen trần',
  'ket-nuoc-am-tuong': 'Két nước âm tường',
  'voi-rua-chen': 'Vòi rửa chén',
  'phu-kien-bon-tam': 'Phụ kiện bồn tắm',
  'nap-bon-cau': 'Nắp bồn cầu',
  'lo-giay': 'Lô giấy',
  'voi-ban-tu-dong': 'Vòi bàn tự động',
  'voi-co-cao': 'Vòi cổ cao',
  'voi-xit-ve-sinh': 'Vòi xịt vệ sinh',
  'bon-cau-xom': 'Bồn cầu xổm',
  'guong-phong-tam': 'Gương phòng tắm',
  'moc-ao': 'Móc áo',
  'lavabo-duong-vanh': 'Lavabo dương vành',
  'nap-ket-nuoc': 'Nắp két nước',
  'ga-thoat-san': 'Ga thoát sàn',
  'van-sen': 'Van sen',
  'hop-xa-phong': 'Hộp xà phòng',
  'phu-kien-lavabo': 'Phụ kiện lavabo',
};

function getProductTypeLabel(slug) {
  if (!slug) return '';
  return PRODUCT_TYPE_LABELS[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── FAMILY GROUP EXTRACTION ─────────────────────────────────────────────────

/**
 * Extract a family group key for sorting products that belong together.
 * Priority: variant_group > SKU base prefix.
 */
function getFamilyGroup(product) {
  // If variant_group exists, use it
  if (product.variant_group) {
    return product.variant_group;
  }
  
  // Extract SKU base: take the part before first '/' or '#' 
  // e.g., "MS636CDRW12#XW" → "MS636CDRW12"
  // e.g., "CW812RA#W/TC811SJ#W" → "CW812RA"
  const sku = product.sku || '';
  const match = sku.match(/^([A-Za-z]+[\d]+[A-Za-z]*)/);
  if (match) {
    return match[1];
  }
  
  // Fallback: use full SKU
  return sku;
}

// ─── STOCK STATUS LABELS ─────────────────────────────────────────────────────

function getStockLabel(status) {
  const map = {
    'in_stock': 'Còn hàng',
    'out_of_stock': 'Hết hàng',
    'pre_order': 'Đặt trước',
    'discontinued': 'Ngừng kinh doanh',
  };
  return map[status] || status;
}

// ─── MAIN EXPORT LOGIC ──────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Bắt đầu export sản phẩm...\n');
  
  // ── Step 1: Query all products with relations ──
  console.log('📦 Đang truy vấn toàn bộ sản phẩm...');
  const products = await prisma.products.findMany({
    include: {
      brands: { select: { name: true, sort_order: true } },
      categories: { select: { name: true, sort_order: true } },
      subcategories: { select: { name: true, sort_order: true } },
      origins: { select: { name: true } },
      colors: { select: { name: true } },
      materials: { select: { name: true } },
    },
    orderBy: [
      { categories: { sort_order: 'asc' } },
      { subcategories: { sort_order: 'asc' } },
    ],
  });
  
  console.log(`   ✅ Đã tải ${products.length} sản phẩm\n`);
  
  // ── Step 2: Transform & sort ──
  console.log('🔄 Đang sắp xếp theo: Cấp 1 → Cấp 2 → Thương Hiệu → Nhóm Gia Đình...');
  
  const transformed = products.map((p, idx) => ({
    categoryName: p.categories?.name || '',
    categorySortOrder: p.categories?.sort_order ?? 999,
    subcategoryName: p.subcategories?.name || '',
    subcategorySortOrder: p.subcategories?.sort_order ?? 999,
    brandName: p.brands?.name || '',
    brandSortOrder: p.brands?.sort_order ?? 999,
    familyGroup: getFamilyGroup(p),
    productType: getProductTypeLabel(p.product_type),
    sku: p.sku,
    name: p.name,
    displayName: p.display_name || '',
    price: p.price,
    originalPrice: p.original_price,
    onlineDiscount: p.online_discount_amount,
    priceDisplay: p.price_display || '',
    originName: p.origins?.name || '',
    colorName: p.colors?.name || '',
    materialName: p.materials?.name || '',
    warrantyMonths: p.warranty_months,
    stockStatus: p.stock_status,
    isActive: p.is_active,
    isCombo: p.is_combo,
    isFeatured: p.is_featured,
    imageUrl: p.image_main_url || '',
    sortOrder: p.sort_order,
  }));
  
  // Multi-level sort
  transformed.sort((a, b) => {
    // 1. Category L1 sort order
    if (a.categorySortOrder !== b.categorySortOrder) return a.categorySortOrder - b.categorySortOrder;
    // 2. Category L2 sort order
    if (a.subcategorySortOrder !== b.subcategorySortOrder) return a.subcategorySortOrder - b.subcategorySortOrder;
    // 3. Brand name alphabetical
    const brandCmp = a.brandName.localeCompare(b.brandName, 'vi');
    if (brandCmp !== 0) return brandCmp;
    // 4. Family group  
    const familyCmp = a.familyGroup.localeCompare(b.familyGroup, 'vi');
    if (familyCmp !== 0) return familyCmp;
    // 5. SKU within family
    return a.sku.localeCompare(b.sku, 'vi');
  });
  
  console.log('   ✅ Sắp xếp hoàn tất\n');
  
  // ── Step 3: Define CSV headers ──
  const HEADERS = [
    'STT',
    'Mã SP (SKU)',
    'Tên sản phẩm',
    'Danh mục Cấp 1',
    'Danh mục Cấp 2',
    'Loại sản phẩm',
    'Thương hiệu',
    'Nhóm gia đình',
    'Giá bán (VNĐ)',
    'Giá niêm yết (VNĐ)',
    'Giảm giá online (VNĐ)',
    'Hiển thị giá',
    'Xuất xứ',
    'Màu sắc',
    'Chất liệu',
    'Bảo hành (tháng)',
    'Tình trạng kho',
    'Trạng thái',
    'Combo',
    'Nổi bật',
    'Link ảnh chính',
  ];
  
  // ── Step 4: Build rows ──
  function buildRow(item, index) {
    return [
      index + 1,
      item.sku,
      item.name,
      item.categoryName,
      item.subcategoryName,
      item.productType,
      item.brandName,
      item.familyGroup,
      formatPrice(item.price),
      formatPrice(item.originalPrice),
      formatPrice(item.onlineDiscount),
      item.priceDisplay,
      item.originName,
      item.colorName,
      item.materialName,
      item.warrantyMonths || '',
      getStockLabel(item.stockStatus),
      item.isActive ? 'Đang bán' : 'Ngừng bán',
      item.isCombo ? 'Có' : '',
      item.isFeatured ? 'Có' : '',
      item.imageUrl,
    ];
  }
  
  // ── Step 5: Write all-products.csv ──
  const exportDir = path.join(__dirname, '..', 'exports');
  const allRows = transformed.map((item, i) => buildRow(item, i));
  
  const allProductsPath = path.join(exportDir, 'all-products.csv');
  writeCSV(allProductsPath, HEADERS, allRows);
  console.log(`📄 all-products.csv — ${allRows.length} sản phẩm`);
  
  // ── Step 6: Write per-brand CSVs ──
  const brandDir = path.join(exportDir, 'by-brand');
  const brandGroups = {};
  
  for (const item of transformed) {
    const brandKey = item.brandName || 'Chưa phân loại';
    if (!brandGroups[brandKey]) brandGroups[brandKey] = [];
    brandGroups[brandKey].push(item);
  }
  
  const brandNames = Object.keys(brandGroups).sort((a, b) => a.localeCompare(b, 'vi'));
  
  for (const brandName of brandNames) {
    const items = brandGroups[brandName];
    const rows = items.map((item, i) => buildRow(item, i));
    const safeFileName = brandName.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-');
    const brandPath = path.join(brandDir, `${safeFileName}.csv`);
    writeCSV(brandPath, HEADERS, rows);
    console.log(`   📁 ${safeFileName}.csv — ${rows.length} sản phẩm`);
  }
  
  // ── Step 7: Write summary.csv ──
  console.log('\n📊 Đang tạo bảng tổng hợp...');
  
  const summaryHeaders = ['Danh mục Cấp 1', 'Danh mục Cấp 2', 'Thương hiệu', 'Số lượng SP', 'Có giá', 'Không có giá'];
  const summaryMap = {};
  
  for (const item of transformed) {
    const key = `${item.categoryName}|||${item.subcategoryName}|||${item.brandName || 'Chưa phân loại'}`;
    if (!summaryMap[key]) {
      summaryMap[key] = { count: 0, hasPrice: 0, noPrice: 0 };
    }
    summaryMap[key].count++;
    if (item.price && Number(item.price) > 0) {
      summaryMap[key].hasPrice++;
    } else {
      summaryMap[key].noPrice++;
    }
  }
  
  const summaryRows = Object.entries(summaryMap)
    .sort(([a], [b]) => a.localeCompare(b, 'vi'))
    .map(([key, stats]) => {
      const [cat, sub, brand] = key.split('|||');
      return [cat, sub, brand, stats.count, stats.hasPrice, stats.noPrice];
    });
  
  // Add total row
  const totalCount = summaryRows.reduce((s, r) => s + r[3], 0);
  const totalHasPrice = summaryRows.reduce((s, r) => s + r[4], 0);
  const totalNoPrice = summaryRows.reduce((s, r) => s + r[5], 0);
  summaryRows.push(['TỔNG CỘNG', '', '', totalCount, totalHasPrice, totalNoPrice]);
  
  const summaryPath = path.join(exportDir, 'summary.csv');
  writeCSV(summaryPath, summaryHeaders, summaryRows);
  console.log(`📄 summary.csv — ${summaryRows.length - 1} dòng phân loại\n`);
  
  // ── Final report ──
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ EXPORT HOÀN TẤT');
  console.log('═══════════════════════════════════════════════════');
  console.log(`   📦 Tổng sản phẩm: ${products.length}`);
  console.log(`   📄 File tổng: exports/all-products.csv`);
  console.log(`   📁 File theo hãng: ${brandNames.length} files trong exports/by-brand/`);
  console.log(`   📊 Bảng tổng hợp: exports/summary.csv`);
  console.log(`   📂 Thư mục output: ${exportDir}`);
  console.log('═══════════════════════════════════════════════════\n');
  
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Lỗi:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
