import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Testing distinct query for products with null variant_group')
    
    // Test 1: Just distinct
    const dist = await prisma.products.findMany({
        take: 10,
        distinct: ['variant_group'],
        select: { id: true, sku: true, variant_group: true }
    })
    
    console.log('Total distinct returned:', dist.length)
    console.log(dist.map(d => `${d.sku} -> ${d.variant_group}`))
}

main().finally(() => prisma.$disconnect())
