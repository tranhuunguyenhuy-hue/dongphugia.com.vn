const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE products DROP COLUMN IF EXISTS is_new;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE products DROP COLUMN IF EXISTS is_bestseller;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promotion BOOLEAN DEFAULT false;`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_products_promotion ON products(is_promotion);`)
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS idx_products_bestseller;`)
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS idx_products_is_new;`)
  console.log("Migration successful")
}

main().catch(console.error).finally(() => prisma.$disconnect())
