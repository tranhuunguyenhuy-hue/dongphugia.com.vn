import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Ensure we load .env.local
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('Bắt đầu chèn cột original_price vào bảng products...')
  try {
    const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "original_price" DECIMAL(15, 2);
    `)
    console.log('✅ Đã thêm cột original_price thành công! (Kết quả:', result, ')')
  } catch (error) {
    console.error('❌ Lỗi khi thêm cột:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
