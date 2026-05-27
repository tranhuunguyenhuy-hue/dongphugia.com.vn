const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.products.findMany({
    where: { 
        brands: { slug: 'inax' }, 
        OR: [
            { original_price: null }, 
            { original_price: 0 }
        ], 
        price: { gt: 0 } 
    },
    select: { sku: true, name: true, price: true, original_price: true }
  });
  console.log('Số lượng sản phẩm INAX không có giá gốc nhưng có giá khuyến mãi:', items.length);
  if(items.length > 0) {
      console.log('Ví dụ 5 sản phẩm đầu tiên:');
      console.log(items.slice(0, 5));
  }

  const itemsAll = await prisma.products.findMany({
    where: { 
        OR: [
            { original_price: null }, 
            { original_price: 0 }
        ], 
        price: { gt: 0 } 
    },
    select: { sku: true, name: true, price: true, original_price: true }
  });
  console.log('\nSố lượng xét trên TOÀN BỘ database:', itemsAll.length);
}
main().finally(() => prisma.$disconnect());
