import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
});

async function main() {
  console.log('Adding product_type and product_sub_type columns...');
  try {
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL statement_timeout = '120s'`),
      prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(50)`),
      prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS product_sub_type VARCHAR(50)`)
    ]);
    console.log('Columns added or already exist!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
