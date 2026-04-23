/**
 * C3: Fill product_type cho Sen Tắm (sub=3) + Lavabo (sub=2) + Bồn Tắm (sub=4)
 * 
 * Sen Tắm types (từ tên sản phẩm):
 * - "Bộ sen tắm cây" / "Sen cây" → "sen-cay" (shower column/tower)
 * - "Sen tắm cây đứng" / "Bộ sen cây đứng" → "sen-cay"
 * - "Sen tắm / Sen vòi hoa sen" → "sen-tam" (handheld/overhead showerhead)
 * - "Tay sen" / "Đầu sen" → "tay-sen" (handheld only)
 * - "Bát sen" / "Đầu sen âm trần" → "bat-sen" (rain shower head)
 * - "Sen nhiệt độ" / "Ổn nhiệt" chứa → thêm -nhiet-do suffix
 * 
 * Lavabo types (từ specs "Hình dáng" / tên):
 * - "Lavabo đặt bàn" / "Âm bàn" → "lavabo-am-ban"
 * - "Lavabo treo tường" / "Treo tường" → "lavabo-treo-tuong"
 * - "Lavabo đặt trên bàn" / "Đặt trên bàn" → "lavabo-dat-tren-ban"
 * - "Lavabo đặt chân" / "Chân đế" → "lavabo-chan-de"
 * - "Lavabo bán âm" → "lavabo-ban-am"
 * 
 * Run: npx tsx --env-file=.env.local scripts/db/fill-product-type-c3.mts [--execute]
 */
import { PrismaClient } from '@prisma/client';
const isDryRun = !process.argv.includes('--execute');
const p = new PrismaClient();

// ─── SEN TẮM type mapping ──────────────────────────────────────────────────

function mapSenTamType(name: string, specs: any): string {
  const n = name.toLowerCase();
  const congnge = String(specs?.['Chế độ'] || specs?.['Thiết kế'] || '').toLowerCase();
  const thietke = String(specs?.['Thiết kế'] || '').toLowerCase();

  // Bát sen âm trần / overhead rain shower
  if (n.includes('bát sen') || n.includes('bat sen') || n.includes('âm trần') || n.includes('đầu sen âm')) {
    return 'bat-sen';
  }

  // Tay sen cầm tay / handheld
  if (n.includes('tay sen') || n.includes('đầu sen cầm tay')) {
    return 'tay-sen';
  }

  // Bộ sen cây / sen cây đứng (shower column)
  if (
    n.includes('bộ sen tắm cây') || n.includes('bộ sen cây') ||
    n.includes('sen cây') || n.includes('sen tắm cây') ||
    n.includes('sen cây đứng') || thietke.includes('cây')
  ) {
    // Check nhiệt độ / ổn nhiệt
    if (n.includes('nhiệt độ') || n.includes('ổn nhiệt') || n.includes('nóng lạnh')) {
      return 'sen-cay-nhiet-do';
    }
    return 'sen-cay';
  }

  // Sen tắm âm tường (concealed shower set)
  if (n.includes('âm tường') || n.includes('am tuong') || thietke.includes('âm tường')) {
    return 'sen-am-tuong';
  }

  // Vòi sen / Sen tắm thông thường
  if (n.includes('nhiệt độ') || n.includes('ổn nhiệt')) {
    return 'sen-nhiet-do';
  }

  return 'sen-tam';
}

// ─── LAVABO type mapping ────────────────────────────────────────────────────

function mapLavaboType(name: string, specs: any): string {
  const n = name.toLowerCase();
  const hinhDang = String(specs?.['Hình dáng'] || specs?.['Kiểu lắp đặt'] || '').toLowerCase();

  // Âm bàn (undermount)
  if (n.includes('âm bàn') || n.includes('am ban') || hinhDang.includes('âm bàn')) {
    return 'lavabo-am-ban';
  }

  // Đặt trên bàn (vessel/countertop)
  if (n.includes('đặt trên bàn') || n.includes('dat tren ban') || hinhDang.includes('đặt trên bàn') || hinhDang.includes('countertop')) {
    return 'lavabo-dat-tren-ban';
  }

  // Bán âm (semi-recessed)
  if (n.includes('bán âm') || n.includes('ban am') || hinhDang.includes('bán âm')) {
    return 'lavabo-ban-am';
  }

  // Chân đế / đặt chân (pedestal)
  if (n.includes('chân đế') || n.includes('chan de') || n.includes('đặt chân') ||
      hinhDang.includes('chân đế') || hinhDang.includes('đặt chân')) {
    return 'lavabo-chan-de';
  }

  // Treo tường (wall-hung)
  if (n.includes('treo tường') || n.includes('treo tuong') || hinhDang.includes('treo tường') || hinhDang.includes('wall')) {
    return 'lavabo-treo-tuong';
  }

  // Lavabo đặt bàn (default nếu có "bàn" trong tên)
  if (n.includes('đặt bàn') || hinhDang.includes('đặt bàn')) {
    return 'lavabo-dat-ban';
  }

  return 'lavabo';
}

// ─── BỒN TẮM type mapping ──────────────────────────────────────────────────
function mapBonTamType(name: string, specs: any): string {
  const n = name.toLowerCase();
  if (n.includes('massage') || n.includes('jacuzzi') || n.includes('sục khí')) return 'bon-tam-massage';
  if (n.includes('nằm tự đứng') || n.includes('tự đứng') || n.includes('free standing')) return 'bon-tam-tu-dung';
  if (n.includes('âm sàn') || n.includes('chìm sàn')) return 'bon-tam-am-san';
  if (n.includes('xây') || n.includes('đặt góc')) return 'bon-tam-xay';
  return 'bon-tam';
}

async function main() {
  console.log(`\n🚀 Phase C3: Fill product_type — Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  type Update = { id: number; product_type: string; name: string };
  const updates: Update[] = [];

  // ── Sen Tắm (sub=3) ──
  const senTam = await p.products.findMany({
    where: { is_active: true, subcategory_id: 3, product_type: null },
    select: { id: true, name: true, specs: true }
  });
  console.log(`📦 Sen Tắm cần fill: ${senTam.length} sp`);
  senTam.forEach(sp => {
    updates.push({ id: sp.id, product_type: mapSenTamType(sp.name, sp.specs), name: sp.name });
  });

  // ── Lavabo (sub=2) ──
  const lavabo = await p.products.findMany({
    where: { is_active: true, subcategory_id: 2, product_type: null },
    select: { id: true, name: true, specs: true }
  });
  console.log(`📦 Lavabo cần fill: ${lavabo.length} sp`);
  lavabo.forEach(sp => {
    updates.push({ id: sp.id, product_type: mapLavaboType(sp.name, sp.specs), name: sp.name });
  });

  // ── Bồn Tắm (sub=4) ──
  const bonTam = await p.products.findMany({
    where: { is_active: true, subcategory_id: 4, product_type: null },
    select: { id: true, name: true, specs: true }
  });
  console.log(`📦 Bồn Tắm cần fill: ${bonTam.length} sp`);
  bonTam.forEach(sp => {
    updates.push({ id: sp.id, product_type: mapBonTamType(sp.name, sp.specs), name: sp.name });
  });

  // Stats
  const typeCount: Record<string, number> = {};
  updates.forEach(u => { typeCount[u.product_type] = (typeCount[u.product_type] || 0) + 1; });

  console.log('\n📊 Distribution:');
  Object.entries(typeCount).sort((a, b) => b[1] - a[1]).forEach(([t, c]) =>
    console.log(`  ${t}: ${c} sp`)
  );

  // Preview examples
  const typeExamples: Record<string, string> = {};
  updates.forEach(u => {
    if (!typeExamples[u.product_type]) typeExamples[u.product_type] = u.name.substring(0, 60);
  });
  console.log('\n📝 Example per type:');
  Object.entries(typeExamples).forEach(([t, n]) => console.log(`  [${t}] → ${n}`));

  if (!isDryRun) {
    console.log('\n⚡ Executing...');
    let done = 0;
    for (const u of updates) {
      await p.products.update({ where: { id: u.id }, data: { product_type: u.product_type } });
      done++;
      if (done % 100 === 0) console.log(`   ${done}/${updates.length}...`);
    }
    console.log(`\n✅ Updated ${done} products with product_type`);
  } else {
    console.log(`\n💡 Run với --execute để fill ${updates.length} sản phẩm`);
  }
}
main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
