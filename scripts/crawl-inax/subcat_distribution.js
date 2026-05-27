const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.products.findMany({
    where: { brands: { slug: 'inax' } },
    select: {
      subcategories: { select: { slug: true, name: true } }
    }
  });

  const dist = {};
  products.forEach(p => {
    const slug = p.subcategories?.slug || 'NULL';
    const name = p.subcategories?.name || 'Không xác định';
    const key = `${slug} (${name})`;
    if (!dist[key]) dist[key] = 0;
    dist[key]++;
  });

  console.log('=== PHÂN PHỐI SẢN PHẨM INAX THEO SUBCATEGORY SLUG ===');
  Object.entries(dist).sort((a,b)=>b[1]-a[1]).forEach(([k, v]) => {
    console.log(`- ${k}: ${v} sản phẩm`);
  });
}

main().finally(() => prisma.$disconnect());
