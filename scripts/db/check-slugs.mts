import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const sub32 = await p.subcategories.findFirst({ where: { id: 32 }, select: { slug: true, name: true } });
console.log('sub=32:', JSON.stringify(sub32));
const sub33 = await p.subcategories.findFirst({ where: { id: 33 }, select: { slug: true, name: true } });
console.log('sub=33:', JSON.stringify(sub33));
const sub9 = await p.subcategories.findFirst({ where: { id: 9 }, select: { slug: true, name: true } });
console.log('sub=9:', JSON.stringify(sub9));
const sub1 = await p.subcategories.findFirst({ where: { id: 1 }, select: { slug: true, name: true } });
console.log('sub=1:', JSON.stringify(sub1));
// Kiểm tra sp vừa fix có đúng sub không
const sample = await p.products.findMany({
  where: { id: { in: [1988, 3664, 4595] } },
  select: { id: true, subcategory_id: true, name: true, subcategories: { select: { slug: true } } }
});
sample.forEach(s => console.log(`ID:${s.id} sub=${s.subcategory_id} slug=${s.subcategories?.slug} | ${s.name.substring(0,40)}`));
await p.$disconnect();
