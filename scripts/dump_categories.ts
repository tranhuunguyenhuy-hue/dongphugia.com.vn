import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const categories = await prisma.categories.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
    include: {
      subcategories: {
        where: { is_active: true },
        orderBy: { sort_order: 'asc' }
      }
    }
  })

  for (const cat of categories) {
    console.log(`- [${cat.slug}] ${cat.name}`)
    for (const sub of cat.subcategories) {
      console.log(`  └─ [${sub.slug}] ${sub.name}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
