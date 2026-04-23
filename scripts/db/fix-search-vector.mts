import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Ensure we load .env.local
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('Đang khôi phục lại cột search_vector bị mất do lệnh npx prisma db push trước đó...')
  try {
    const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
    `)
    console.log('✅ Khôi phục thành công! (Trigger của Supabase đã được giải cứu)')
  } catch (error) {
    console.error('❌ Lỗi khi thêm cột:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
