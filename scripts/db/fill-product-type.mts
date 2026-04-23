/**
 * Phase 2.2 — Auto-fill product_type from product name patterns
 * sub=1 (Bồn Cầu) → bon-cau-1-khoi, bon-cau-2-khoi, etc.
 * sub=9 (Nắp Bồn Cầu) → nap-dong-em, nap-rua-co, nap-dien-tu
 * 
 * Run: npx tsx --env-file=.env.local scripts/db/fill-product-type.mts [--execute]
 */
import { PrismaClient } from '@prisma/client';

const isDryRun = !process.argv.includes('--execute');
const prisma = new PrismaClient();

// Mapping rules: [regex, product_type, product_sub_type | null]
type Rule = [RegExp, string, string | null];

const TOILET_RULES: Rule[] = [
  [/1\s*khối|một\s*khối|1-khối/i, 'bon-cau-1-khoi', null],
  [/2\s*khối|hai\s*khối|2-khối/i, 'bon-cau-2-khoi', null],
  [/treo\s*tường|treo tuong/i, 'bon-cau-treo-tuong', null],
  [/đặt\s*sàn|dat\s*san/i, 'bon-cau-dat-san', null],
  [/thông\s*minh|thong\s*minh|washlet|bidet/i, 'bon-cau-thong-minh', null],
  [/bệt|bàn\s*cầu\s*bệt/i, 'bon-cau-bet', null],
  [/xổm|ngồi\s*xổm/i, 'bon-cau-xom', null],
];

const LID_RULES: Rule[] = [
  [/đóng\s*êm|urea|soft\s*close/i, 'nap-bon-cau', 'nap-dong-em'],
  [/rửa\s*cơ|rua\s*co/i, 'nap-bon-cau', 'nap-rua-co'],
  [/điện\s*tử|dien\s*tu|washlet|bidet/i, 'nap-bon-cau', 'nap-dien-tu'],
  [/nắp|bệ\s*ngồi/i, 'nap-bon-cau', null], // fallback for lids
];

function classifyToilet(name: string): { product_type: string; product_sub_type: string | null } | null {
  const lower = name.toLowerCase();
  // Chỉ classify bồn cầu thật — bỏ qua phụ kiện "van xả", "bộ đế", vv
  const isToilet = lower.startsWith('bồn cầu') || lower.startsWith('bàn cầu') || lower.startsWith('bộ bồn cầu');
  if (!isToilet) return null;

  for (const [regex, type, subType] of TOILET_RULES) {
    if (regex.test(name)) return { product_type: type, product_sub_type: subType };
  }
  return null;
}

function classifyLid(name: string): { product_type: string; product_sub_type: string | null } | null {
  for (const [regex, type, subType] of LID_RULES) {
    if (regex.test(name)) return { product_type: type, product_sub_type: subType };
  }
  return null;
}

async function main() {
  console.log(`\n🚀 Phase 2.2 — Auto-fill product_type`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (không ghi DB)' : '⚡ EXECUTE (ghi DB)'}\n`);

  // Fetch all Bồn Cầu (sub=1) and Nắp Bồn Cầu (sub=9)
  const products = await prisma.products.findMany({
    where: { subcategory_id: { in: [1, 9] }, is_active: true },
    select: { id: true, name: true, subcategory_id: true, product_type: true, product_sub_type: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Tổng sản phẩm cần phân loại: ${products.length} (sub=1: ${products.filter(p => p.subcategory_id === 1).length}, sub=9: ${products.filter(p => p.subcategory_id === 9).length})\n`);

  let updatesQueued = 0;
  let alreadyHasType = 0;
  let noMatch = 0;
  const noMatchList: { id: number; name: string; sub: number | null }[] = [];

  const updates: Array<{ id: number; product_type: string; product_sub_type: string | null }> = [];

  for (const p of products) {
    if (p.product_type) {
      alreadyHasType++;
      continue;
    }

    const classify = p.subcategory_id === 9 ? classifyLid : classifyToilet;
    const result = classify(p.name);

    if (result) {
      console.log(`  [CLASSIFY] ID:${p.id} → ${result.product_type}${result.product_sub_type ? ' / ' + result.product_sub_type : ''} | ${p.name.substring(0, 60)}`);
      updates.push({ id: p.id, ...result });
      updatesQueued++;
    } else {
      noMatch++;
      noMatchList.push({ id: p.id, name: p.name.substring(0, 70), sub: p.subcategory_id });
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 KẾT QUẢ PHÂN LOẠI`);
  console.log(`======================================================`);
  console.log(`Đã có product_type:   ${alreadyHasType} sp`);
  console.log(`Sẽ được gán type:     ${updatesQueued} sp`);
  console.log(`Không khớp pattern:   ${noMatch} sp`);
  if (noMatchList.length > 0 && noMatchList.length <= 20) {
    console.log(`\n⚠️  Không khớp (cần manual review):`);
    noMatchList.forEach(p => console.log(`   ID:${p.id} [sub=${p.sub}] ${p.name}`));
  }

  const coverage = Math.round((updatesQueued / (products.length - alreadyHasType)) * 100) || 0;
  console.log(`\n📈 Coverage: ${coverage}% (target: >80%)\n`);

  if (!isDryRun && updates.length > 0) {
    console.log(`⚡ Bắt đầu UPDATE ${updates.length} records...`);
    let done = 0;
    for (const u of updates) {
      await prisma.products.update({
        where: { id: u.id },
        data: { product_type: u.product_type, product_sub_type: u.product_sub_type },
      });
      done++;
      if (done % 50 === 0) console.log(`  ...${done}/${updates.length}`);
    }
    console.log(`\n✅ UPDATE THÀNH CÔNG. ${done} sản phẩm đã có product_type.`);
  } else if (isDryRun) {
    console.log(`💡 Đây là DRY RUN. Chạy với --execute để ghi vào DB:\n   npx tsx --env-file=.env.local scripts/db/fill-product-type.mts --execute`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
