/**
 * Scan naming anomalies across all products
 * Tìm hiểu tại sao tên sản phẩm bị kỳ lạ
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Pattern 1: Tên chứa "+" (combo SKU nối nhau)
  const withPlus = await p.products.count({
    where: { is_active: true, name: { contains: '+' } }
  });

  // Pattern 2: Tên bị lặp SKU ở cuối (tên kết thúc bằng đúng SKU)
  const samples = await p.products.findMany({
    where: { is_active: true, name: { contains: '+' } },
    select: { id: true, name: true, sku: true },
    take: 10,
    orderBy: { id: 'desc' }
  });

  // Pattern 3: Tên chứa SKU bị duplicate (SKU xuất hiện 2 lần trong tên)
  const duplicateSku = await p.products.findMany({
    where: {
      is_active: true,
      AND: [
        { name: { not: { equals: '' } } },
        // SKU xuất hiện trong tên nhưng không phải bồn cầu có ngoặc
        { name: { contains: '#XW' } }
      ]
    },
    select: { id: true, name: true, sku: true },
    take: 5
  });

  // Pattern 4: Tên quá dài (> 120 ký tự)
  const longNames = await p.products.findMany({
    where: { is_active: true },
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' }
  });
  const veryLong = longNames.filter(p => p.name.length > 120).slice(0, 5);

  // Pattern 5: Phân tích brand Duravit
  const duravit = await p.products.findMany({
    where: { is_active: true, OR: [
      { name: { contains: 'Duravit' } },
      { brands: { name: { contains: 'Duravit' } } }
    ]},
    select: { id: true, name: true, sku: true },
    take: 5
  });

  console.log(`\n=== PHÂN TÍCH TÊN SẢN PHẨM KỲ LẠ ===\n`);

  console.log(`📌 Pattern 1: Tên chứa dấu "+" (combo SKU): ${withPlus} sp`);
  samples.forEach(s => {
    console.log(`\n  ID:${s.id}`);
    console.log(`  Tên: ${s.name.substring(0, 120)}`);
    console.log(`  SKU: ${s.sku?.substring(0, 80)}`);
  });

  console.log(`\n📌 Pattern 2: Tên có #XW (bị SKU suffix): ${duplicateSku.length} sp mẫu`);
  duplicateSku.forEach(s => {
    console.log(`  ID:${s.id} SKU:${s.sku} | ${s.name.substring(0, 80)}`);
  });

  console.log(`\n📌 Pattern 3: Tên quá dài (>120 ký tự): ${veryLong.length} mẫu`);
  veryLong.forEach(s => {
    console.log(`  ID:${s.id} LEN:${s.name.length} | ${s.name.substring(0, 100)}...`);
  });

  console.log(`\n📌 Pattern 4: Sản phẩm Duravit mẫu`);
  duravit.forEach(s => {
    console.log(`  ID:${s.id} | ${s.name.substring(0, 100)}`);
  });

  // Root cause analysis: đếm tổng các pattern
  const totalWithPlus = withPlus;
  console.log(`\n============================`);
  console.log(`TỔNG: ${totalWithPlus} sp có tên chứa "+" → Combo product SKU ghép`);

  await p.$disconnect();
}
main().catch(console.error);
