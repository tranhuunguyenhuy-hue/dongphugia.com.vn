/**
 * Scan ALL non-toilet products still in sub=1 (Bồn Cầu)
 * Tìm sản phẩm không phải bồn cầu thật còn sót lại
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Lấy toàn bộ sub=1 và lọc những sp KHÔNG PHẢI bồn cầu thật
  const all = await p.products.findMany({
    where: { subcategory_id: 1, is_active: true },
    select: { id: true, name: true, sku: true, product_type: true },
    orderBy: { name: 'asc' }
  });

  // Bồn cầu thật: phải bắt đầu bằng "Bồn cầu", "Bàn cầu", "Bộ bồn cầu", "Bệt"
  const TOILET_PREFIXES = [
    'bồn cầu', 'bàn cầu', 'bộ bồn cầu', 'bệt', 'neorest', 'washlet'
  ];

  const isRealToilet = (name: string) => {
    const n = name.toLowerCase();
    return TOILET_PREFIXES.some(prefix => n.startsWith(prefix));
  };

  const nonToilets = all.filter(p => !isRealToilet(p.name));

  console.log(`\n📊 Tổng sub=1: ${all.length} sp`);
  console.log(`   Bồn cầu thật: ${all.length - nonToilets.length} sp`);
  console.log(`   KHÔNG phải bồn cầu: ${nonToilets.length} sp\n`);
  console.log(`=== DANH SÁCH CẦN XỬ LÝ ===`);
  nonToilets.forEach(s => {
    console.log(`  ID:${s.id.toString().padEnd(5)} [${(s.product_type || 'NULL').padEnd(22)}] ${s.name.substring(0, 70)}`);
  });

  console.log(`\n=== IDs (copy để script) ===`);
  console.log(nonToilets.map(s => s.id).join(', '));

  await p.$disconnect();
}
main().catch(console.error);
