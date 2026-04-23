import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const prisma = new PrismaClient()

async function main() {
  console.log('Đang tìm 5 sản phẩm nổi bật để rải giá gốc (Test Giảm giá)...')
  
  // Find 5 featured products that have a non-null price
  const products = await prisma.products.findMany({
    where: { 
      is_featured: true,
      price: { not: null }
    },
    take: 5
  })

  if (products.length === 0) {
    console.log('Không tìm thấy sản phẩm nổi bật nào có giá.')
    return
  }

  for (const product of products) {
    // Increase the price by roughly 20-30%
    const currentPrice = Number(product.price)
    const multiplier = 1.2 + Math.random() * 0.15 // 1.2x to 1.35x
    const originalPrice = Math.round((currentPrice * multiplier) / 1000) * 1000 // Round to nearest 1000

    await prisma.$executeRawUnsafe(`
      UPDATE products 
      SET original_price = ${originalPrice} 
      WHERE id = ${product.id}
    `)
    
    const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    console.log(`✅ Cập nhật: "${product.name}"`)
    console.log(`   Giá giảm: ${currentPrice.toLocaleString('vi-VN')} đ | Giá gốc: ${originalPrice.toLocaleString('vi-VN')} đ (-${discount}%)`)
  }
  
  console.log('\n🎉 Hoàn tất! Vui lòng F5 lại trang chủ để xem nhãn giảm giá.')
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
