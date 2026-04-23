/**
 * Agent 1: Database Architect
 * Di chuyển 34 sản phẩm sai sub từ sub=1 (Bồn Cầu) sang sub=32 (Phụ Kiện Bồn Cầu)
 * Ngoại lệ: ID:3664 (Nắp GROHE) → sub=9 (Nắp Bồn Cầu)
 * 
 * Run: npx tsx --env-file=.env.local scripts/db/fix-misclassified.mts [--execute]
 */
import { PrismaClient } from '@prisma/client';
const isDryRun = !process.argv.includes('--execute');
const p = new PrismaClient();

// IDs xác nhận là Phụ Kiện (sub=32): Van xả, Van khoá, Núm hãm, Bộ cố định, Tay gạt
const TO_PHU_KIEN = [
  1988, 1992, 3857, 3873, 3874, 3875, 3876, 3881, 3896, 3898,
  3927, 3932, 3933, 3939, 3940, 3941, 3942, 3952, 3953, 3956,
  4015, 4041, 4059, 4555, 4556, 4587, 4595, 4596, 4604, 4678,
  4729, 4730, 1989,
];

// ID:3664 là Nắp nên → sub=9
const TO_NAP_BON_CAU = [3664];

async function main() {
  console.log(`\n🔧 Agent 1: DB Fix — Sản phẩm sai subcategory`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  // Preview what will move
  const phuKien = await p.products.findMany({
    where: { id: { in: TO_PHU_KIEN } },
    select: { id: true, name: true }
  });
  const napBonCau = await p.products.findMany({
    where: { id: { in: TO_NAP_BON_CAU } },
    select: { id: true, name: true }
  });

  console.log(`→ ${phuKien.length} sp sẽ chuyển sang sub=32 (Phụ Kiện Bồn Cầu):`);
  phuKien.forEach(s => console.log(`   ✓ ID:${s.id} ${s.name.substring(0, 60)}`));
  console.log(`\n→ ${napBonCau.length} sp sẽ chuyển sang sub=9 (Nắp Bồn Cầu):`);
  napBonCau.forEach(s => console.log(`   ✓ ID:${s.id} ${s.name.substring(0, 60)}`));

  if (!isDryRun) {
    // Move to sub=32
    const r1 = await p.products.updateMany({
      where: { id: { in: TO_PHU_KIEN } },
      data: { subcategory_id: 32, product_type: 'phu-kien-bon-cau' }
    });
    // Move to sub=9
    const r2 = await p.products.updateMany({
      where: { id: { in: TO_NAP_BON_CAU } },
      data: { subcategory_id: 9, product_type: 'nap-bon-cau' }
    });
    console.log(`\n✅ DONE: ${r1.count} → sub=32 | ${r2.count} → sub=9`);

    // Verify new sub=1 count
    const newCount = await p.products.count({ where: { subcategory_id: 1, is_active: true } });
    console.log(`\n📊 Sub=1 (Bồn Cầu) sau fix: ${newCount} sp (giảm từ 531)`);
  } else {
    console.log(`\n💡 DRY RUN. Chạy --execute để cập nhật DB.`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
