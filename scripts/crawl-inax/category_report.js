const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.products.findMany({
    where: { brand_id: 2 },
    select: {
      categories: { select: { name: true } },
      subcategories: { select: { name: true } },
      product_sub_type: true
    }
  });

  const tree = {};

  products.forEach(p => {
    const cat1 = p.categories?.name || 'Không xác định';
    const cat2 = p.subcategories?.name || 'Không xác định';
    const cat3 = p.product_sub_type || 'Không xác định';

    if (!tree[cat1]) tree[cat1] = { count: 0, sub: {} };
    tree[cat1].count++;

    if (!tree[cat1].sub[cat2]) tree[cat1].sub[cat2] = { count: 0, child: {} };
    tree[cat1].sub[cat2].count++;

    if (!tree[cat1].sub[cat2].child[cat3]) tree[cat1].sub[cat2].child[cat3] = 0;
    tree[cat1].sub[cat2].child[cat3]++;
  });

  console.log('=== BÁO CÁO SỐ LƯỢNG SẢN PHẨM INAX THEO DANH MỤC ===\n');
  for (const [cat1, data1] of Object.entries(tree).sort((a,b)=>b[1].count - a[1].count)) {
    console.log(`📦 CẤP 1: ${cat1} (${data1.count} sản phẩm)`);
    
    for (const [cat2, data2] of Object.entries(data1.sub).sort((a,b)=>b[1].count - a[1].count)) {
      console.log(`   ┣━ 📂 CẤP 2: ${cat2} (${data2.count} sản phẩm)`);
      
      for (const [cat3, count] of Object.entries(data2.child).sort((a,b)=>b[1] - a[1])) {
        console.log(`   ┃  ┣━ 📄 CẤP 3: ${cat3} (${count} sản phẩm)`);
      }
    }
    console.log('');
  }
}

main().finally(() => prisma.$disconnect());
