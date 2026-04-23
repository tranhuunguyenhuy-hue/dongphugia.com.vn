import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const quotes = await prisma.quote_requests.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    include: { quote_items: true }
  });
  console.log(JSON.stringify(quotes, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
