import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const [sub1, sub9, sub32, sub33, hasType] = await Promise.all([
    p.products.count({ where: { subcategory_id: 1, is_active: true } }),
    p.products.count({ where: { subcategory_id: 9, is_active: true } }),
    p.products.count({ where: { subcategory_id: 32, is_active: true } }),
    p.products.count({ where: { subcategory_id: 33, is_active: true } }),
    p.products.count({ where: { OR: [{ subcategory_id: 1 }, { subcategory_id: 9 }], product_type: { not: null } } }),
  ]);
  console.log('=== LIVE DB STATS ===');
  console.log(`sub=1  (Bồn Cầu):          ${sub1}`);
  console.log(`sub=9  (Nắp Bồn Cầu):      ${sub9}`);
  console.log(`sub=32 (Phụ Kiện):         ${sub32}`);
  console.log(`sub=33 (Thân Bồn Cầu):     ${sub33}`);
  console.log(`Có product_type (sub1+9):  ${hasType}`);
  await p.$disconnect();
}
main();
