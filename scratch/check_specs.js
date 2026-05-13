const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startDate = new Date('2026-05-01T00:00:00Z');
  const products = await prisma.products.findMany({
    where: {
      created_at: {
        gte: startDate
      }
    },
    select: {
      id: true,
      name: true,
      specs: true,
      created_at: true
    }
  });
  
  console.log(`Total products since May 1: ${products.length}`);

  const requiredSpecs = [
    'Thương hiệu',
    'Nơi sản xuất',
    'Bảo hành',
    'Loại nắp',
    'Kiểu xả',
    'Lượng nước xả',
    'Kiểu thoát',
    'Tâm xả',
    'Hệ thống xả',
    'Loại thân cầu',
    'Thiết kế',
    'Thân kín',
    'Vành',
    'Màu sắc',
    'Công nghệ',
    'Kích thước',
    'Thân cầu',
    'Mẫu nắp'
  ];
  
  const productsWithFullSpecs = products.filter(p => {
    if (!p.specs || typeof p.specs !== 'object') return false;
    const keys = Object.keys(p.specs);
    let matchCount = 0;
    for (const req of requiredSpecs) {
      const found = keys.find(k => k.toLowerCase().includes(req.toLowerCase()));
      if (found && p.specs[found]) {
        matchCount++;
      }
    }
    p.matchCount = matchCount;
    return matchCount >= 10; // at least 10 required specs
  });
  
  console.log(`Products with >=10 required specs: ${productsWithFullSpecs.length}`);
  
  const productsWith15Plus = productsWithFullSpecs.filter(p => p.matchCount >= 15);
  console.log(`Products with >=15 required specs: ${productsWith15Plus.length}`);
  
  if (productsWithFullSpecs.length > 0) {
    const sorted = productsWithFullSpecs.sort((a,b) => b.matchCount - a.matchCount);
    console.log(`Max match count: ${sorted[0].matchCount}`);
    console.log(`Sample spec keys from max match:`, Object.keys(sorted[0].specs));
    
    // Also let's check how many have EXACTLY all 18
    const exact18 = productsWithFullSpecs.filter(p => p.matchCount >= 18);
    console.log(`Products with all 18 specs: ${exact18.length}`);
    
    // Check how many have exactly those specs requested by user (at least 15 is a good proxy for "bồn cầu" products)
    // TOTO toilets specifically have things like "Kiểu xả", "Lượng nước xả", "Kiểu thoát", "Tâm xả", "Hệ thống xả", "Công nghệ"
    const toiletSpecific = ['Kiểu xả', 'Hệ thống xả', 'Tâm xả', 'Công nghệ'];
    const toiletProducts = products.filter(p => {
      if (!p.specs || typeof p.specs !== 'object') return false;
      const keys = Object.keys(p.specs);
      return toiletSpecific.every(req => keys.find(k => k.toLowerCase().includes(req.toLowerCase())));
    });
    console.log(`Products with toilet specific specs (Kiểu xả, Hệ thống xả, Tâm xả, Công nghệ): ${toiletProducts.length}`);
  } else {
    const sample = products.find(p => Object.keys(p.specs || {}).length > 5);
    if (sample) {
      console.log(`Sample keys from a product with some specs:`, Object.keys(sample.specs));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
