import { PrismaClient } from '@prisma/client'
import { normalizeName } from './normalize-toto-names.mjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Bắt đầu quá trình chuẩn hoá tên sản phẩm TOTO...');
  
  const products = await prisma.products.findMany({
    where: { brand_id: 1 }
  });

  console.log('Đã tải ' + products.length + ' sản phẩm TOTO từ Database.');
  let updatedCount = 0;
  let skippedCount = 0;

  for (const p of products) {
    try {
      const newName = normalizeName(p.name, p.product_type);
      
      if (newName !== p.name) {
        await prisma.products.update({
          where: { id: p.id },
          data: { name: newName }
        });
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          console.log('🔄 Đã chuẩn hoá xong ' + updatedCount + ' sản phẩm...');
        }
      } else {
        skippedCount++;
      }
    } catch (e) {
      console.error('Lỗi khi cập nhật sản phẩm ' + p.sku + ':', e.message);
    }
  }

  console.log('\\n=== HOÀN TẤT ===');
  console.log('✅ Đã chuẩn hoá và cập nhật: ' + updatedCount + ' sản phẩm');
  console.log('⏭️  Bỏ qua (Tên đã chuẩn hoặc không áp dụng): ' + skippedCount + ' sản phẩm');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
