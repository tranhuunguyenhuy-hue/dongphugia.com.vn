/**
 * B1: Fill product_feature_values cho Bồn Cầu (sub=1) từ specs JSON
 * 
 * Mapping: specs key → feature slug
 * 
 * Logic:
 * - "Kiểu thoát" → feature slug "thoat-san" | "thoat-ngang"  (binary: true/false)
 * - "Loại nắp" contains "điện tử" → feature "smart" or "semi-smart"
 * - "Công nghệ" contains "CeFiONtect" → feature "cefiontect"
 * - "Loại nắp" = "Nắp đóng êm" → feature "nap-em"
 * - "Kiểu xả" = "Xả tự động" → feature "xa-tu-dong"
 * - "Tính năng nắp rửa" contains "massage" → feature "massage"
 * - "Công nghệ" contains "chống khuẩn" → feature "chong-khuan"
 * 
 * Run: npx tsx --env-file=.env.local scripts/db/fill-feature-values.mts [--execute]
 */
import { PrismaClient } from '@prisma/client';
const isDryRun = !process.argv.includes('--execute');
const p = new PrismaClient();

// Mapping: Kết quả của function → [feature_id]
// Feature IDs từ DB:
// 1=smart, 2=nap-em, 3=xa-tu-dong, 4=cefiontect,
// 5=thoat-san, 6=thoat-ngang, 7=nong-lanh, 8=tiet-kiem-nuoc,
// 9=massage, 10=semi-smart, 11=chong-khuan, 12=tu-dong-lam-sach,
// 13=sensor-hong-ngoai, 14=ro-loc-nguoc, 15=dieu-khien-tu-xa

const FEATURE_IDS = {
  smart: 1,
  'nap-em': 2,
  'xa-tu-dong': 3,
  cefiontect: 4,
  'thoat-san': 5,
  'thoat-ngang': 6,
  'nong-lanh': 7,
  'tiet-kiem-nuoc': 8,
  massage: 9,
  'semi-smart': 10,
  'chong-khuan': 11,
  'tu-dong-lam-sach': 12,
  'sensor-hong-ngoai': 13,
  'ro-loc-nguoc': 14,
  'dieu-khien-tu-xa': 15,
} as const;

/**
 * Rút trích feature slugs từ specs JSON của một sản phẩm
 */
function extractFeatures(specs: any): Array<{ featureId: number; value: string }> {
  const results: Array<{ featureId: number; value: string }> = [];
  if (!specs || typeof specs !== 'object') return results;

  const add = (id: number, val: string) => results.push({ featureId: id, value: val });

  // 1. Kiểu thoát → thoat-san / thoat-ngang
  const kieuThoat = String(specs['Kiểu thoát'] || '').toLowerCase();
  if (kieuThoat.includes('sàn') || kieuThoat.includes('san')) add(FEATURE_IDS['thoat-san'], 'Có');
  if (kieuThoat.includes('ngang'))                              add(FEATURE_IDS['thoat-ngang'], 'Có');

  // 2. Loại nắp / Tính năng nắp rửa → smart, semi-smart, nap-em
  const loaiNap = String(specs['Loại nắp'] || '').toLowerCase();
  const tinhNang = String(specs['Tính năng nắp rửa'] || '').toLowerCase();
  const bangDK  = String(specs['Bảng điều khiển'] || '').toLowerCase();

  if (loaiNap.includes('điện tử') || tinhNang.includes('điều khiển') || bangDK.includes('điều khiển')) {
    if (loaiNap.includes('cảm ứng') || tinhNang.includes('cảm biến') || bangDK.includes('cảm ứng')) {
      add(FEATURE_IDS['smart'], 'Có');
    } else {
      add(FEATURE_IDS['semi-smart'], 'Có');
    }
  }
  if (loaiNap.includes('êm') || loaiNap.includes('slow') || loaiNap.includes('soft')) {
    add(FEATURE_IDS['nap-em'], 'Có');
  }

  // 3. Công nghệ → cefiontect, chong-khuan
  const congNghe = String(specs['Công nghệ'] || '').toLowerCase();
  if (congNghe.includes('cefiontect') || congNghe.includes('cefiontect')) {
    add(FEATURE_IDS['cefiontect'], 'Có');
  }
  if (congNghe.includes('kháng khuẩn') || congNghe.includes('chống khuẩn') || congNghe.includes('antibac')) {
    add(FEATURE_IDS['chong-khuan'], 'Có');
  }

  // 4. Kiểu xả → xa-tu-dong
  const kieuXa = String(specs['Kiểu xả'] || '').toLowerCase();
  if (kieuXa.includes('tự động') || kieuXa.includes('sensor') || kieuXa.includes('auto')) {
    add(FEATURE_IDS['xa-tu-dong'], 'Có');
  }

  // 5. Tính năng nắp rửa → massage
  if (tinhNang.includes('massage') || tinhNang.includes('xung')) {
    add(FEATURE_IDS['massage'], 'Có');
  }

  // 6. Nóng lạnh (có nước nóng)
  if (tinhNang.includes('nước nóng') || tinhNang.includes('sưởi') || bangDK.includes('sưởi')) {
    add(FEATURE_IDS['nong-lanh'], 'Có');
  }

  // 7. Tiết kiệm nước — Lượng nước xả <= 4.8L dual flush
  const luongNuoc = String(specs['Lượng nước xả'] || '');
  if (luongNuoc.includes('/') || luongNuoc.includes('3L') || luongNuoc.includes('3l')) {
    add(FEATURE_IDS['tiet-kiem-nuoc'], luongNuoc);
  }

  // 8. Tự động làm sạch
  if (tinhNang.includes('tự làm sạch') || tinhNang.includes('tự động làm sạch') || congNghe.includes('auto clean')) {
    add(FEATURE_IDS['tu-dong-lam-sach'], 'Có');
  }

  // 9. Điều khiển từ xa / remote
  if (bangDK.includes('remote') || bangDK.includes('từ xa') || tinhNang.includes('từ xa')) {
    add(FEATURE_IDS['dieu-khien-tu-xa'], 'Có');
  }

  // 10. Sensor hồng ngoại
  if (bangDK.includes('hồng ngoại') || bangDK.includes('cảm biến điều khiển') || kieuXa.includes('cảm ứng')) {
    add(FEATURE_IDS['sensor-hong-ngoai'], 'Có');
  }

  return results;
}

async function main() {
  console.log(`\n🚀 Phase B1: Fill product_feature_values — Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  // Lấy tất cả Bồn Cầu active
  const products = await p.products.findMany({
    where: { is_active: true, subcategory_id: 1 },
    select: { id: true, name: true, specs: true },
  });
  console.log(`📦 Tổng Bồn Cầu: ${products.length} sp\n`);

  // Clear existing values nếu execute
  if (!isDryRun) {
    const productIds = products.map(p => p.id);
    const deleted = await p.product_feature_values.deleteMany({
      where: { product_id: { in: productIds } }
    });
    console.log(`🗑️  Cleared ${deleted.count} existing feature values\n`);
  }

  // Feature stats
  const featureCount: Record<number, number> = {};
  let toInsert: Array<{ product_id: number; feature_id: number; value: string }> = [];
  let noFeaturesCount = 0;

  for (const product of products) {
    const features = extractFeatures(product.specs);
    if (features.length === 0) {
      noFeaturesCount++;
      continue;
    }
    features.forEach(f => {
      featureCount[f.featureId] = (featureCount[f.featureId] || 0) + 1;
      toInsert.push({ product_id: product.id, feature_id: f.featureId, value: f.value });
    });
  }

  // Stats
  console.log('📊 Feature distribution:');
  const featureNames: Record<number, string> = {
    1: 'Smart Toilet', 2: 'Nắp Êm', 3: 'Xả Tự Động', 4: 'CeFiONtect',
    5: 'Thoát Sàn', 6: 'Thoát Ngang', 7: 'Nóng Lạnh', 8: 'Tiết Kiệm Nước',
    9: 'Massage', 10: 'Semi-Smart', 11: 'Chống Khuẩn', 12: 'Tự Động Làm Sạch',
    13: 'Sensor Hồng Ngoại', 14: 'RO Lọc Ngược', 15: 'Điều Khiển Từ Xa',
  };
  Object.entries(featureCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, count]) => {
      const pct = Math.round(count / products.length * 100);
      console.log(`  [${count.toString().padStart(3)}/${products.length}] (${pct.toString().padStart(2)}%) ${featureNames[Number(id)]}`);
    });
  console.log(`\n  Sản phẩm không có feature nào: ${noFeaturesCount} sp`);
  console.log(`  Tổng records cần insert: ${toInsert.length}`);

  // Preview sample
  console.log('\n📝 Sample (5 sp đầu):');
  const sample = products.slice(0, 5);
  for (const prod of sample) {
    const feats = extractFeatures(prod.specs);
    if (feats.length > 0) {
      console.log(`  [${prod.id}] ${prod.name.substring(0, 50)}`);
      feats.forEach(f => console.log(`    → ${featureNames[f.featureId]}: ${f.value}`));
    }
  }

  if (!isDryRun && toInsert.length > 0) {
    console.log('\n⚡ Inserting...');
    const result = await p.product_feature_values.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    console.log(`✅ Inserted ${result.count} feature values for Bồn Cầu`);
  } else if (isDryRun) {
    console.log(`\n💡 Run với --execute để insert ${toInsert.length} records`);
  }
}
main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
