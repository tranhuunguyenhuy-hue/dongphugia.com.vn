import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products';
  `
  console.log(result)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
