import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Trồng cây Sàn Gỗ...')
    const sangoType = await prisma.sango_product_types.findFirst({ where: { slug: 'san-go-cong-nghiep' } })
    const typeId = sangoType?.id || 1

    const products = [
        { name: 'Sàn gỗ công nghiệp Dong Phu', slug: 'san-go-dong-phu-1', price: 250000, thickness: 8, ac: 'AC4', warranty: 15 },
        { name: 'Sàn gỗ Robina chống cháy', slug: 'san-go-robina-1', price: 350000, thickness: 12, ac: 'AC5', warranty: 20 },
        { name: 'Sàn gỗ Kosmos vân sồi', slug: 'san-go-kosmos-1', price: 180000, thickness: 8, ac: 'AC3', warranty: 10 },
        { name: 'Sàn nhựa hèm khóa xám', slug: 'san-nhua-hem-khoa-1', price: 220000, thickness: 4, ac: 'AC4', warranty: 5 },
        { name: 'Sàn gỗ tự nhiên Óc Chó', slug: 'san-go-tu-nhien-1', price: 950000, thickness: 15, ac: 'AC6', warranty: 25 },
    ]

    for (const p of products) {
        await prisma.sango_products.upsert({
            where: { slug: p.slug },
            update: {},
            create: {
                name: p.name,
                slug: p.slug,
                sku: 'SG-' + Math.floor(Math.random() * 10000),
                product_type_id: typeId,
                price: p.price,
                thickness_mm: p.thickness,
                ac_rating: p.ac,
                warranty_years: p.warranty,
                is_active: true,
                sort_order: 1
            }
        })
    }
    console.log('✅ Seed Sàn gỗ OK!')
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(async () => { await prisma.$disconnect() })
