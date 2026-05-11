import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const statuses = await prisma.products.groupBy({
        by: ['stock_status'],
        _count: true
    })
    console.log('Stock Statuses:', statuses)
}

main().finally(() => prisma.$disconnect())
