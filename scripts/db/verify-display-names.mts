import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Verify display_name đã được fill
  const withDisplayName = await p.products.count({
    where: { is_active: true, display_name: { not: null } }
  });
  const total = await p.products.count({ where: { is_active: true } });

  console.log(`\n📊 display_name filled: ${withDisplayName}/${total} sp`);

  // Sample Duravit & INAX combo — trước vs sau
  const combos = await p.products.findMany({
    where: {
      is_active: true,
      display_name: { not: null },
      sku: { contains: '+' }
    },
    select: { id: true, name: true, display_name: true, sku: true },
    take: 5
  });
  console.log('\n✅ Sample combo products (AFTER):');
  combos.forEach(s => {
    console.log(`\n  ID:${s.id}`);
    console.log(`  name (DB):      ${s.name.substring(0, 80)}`);
    console.log(`  display_name:   ${s.display_name}`);
  });

  // Sample no-change (phải giữ nguyên)
  const noChange = await p.products.findMany({
    where: {
      is_active: true,
      display_name: null,
      subcategory_id: 1
    },
    select: { id: true, name: true },
    take: 3
  });
  console.log('\n✅ Sample unchanged (display_name = null, dùng name gốc):');
  noChange.forEach(s => console.log(`  ID:${s.id} — ${s.name.substring(0, 60)}`));

  // Names still kỳ (>100 chars còn lại)
  const all = await p.products.findMany({
    where: { is_active: true },
    select: { id: true, name: true, display_name: true }
  });
  const stillLong = all.filter(s => (s.display_name || s.name).length > 100);
  console.log(`\n⚠️  Tên vẫn còn dài >100 ký tự: ${stillLong.length} sp`);
  stillLong.slice(0, 3).forEach(s =>
    console.log(`  ID:${s.id} LEN:${(s.display_name || s.name).length} | ${(s.display_name || s.name).substring(0, 80)}`)
  );
}
main().catch(console.error).finally(() => p.$disconnect());
