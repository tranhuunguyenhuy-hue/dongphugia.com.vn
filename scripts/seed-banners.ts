// Seed script: Insert 3 homepage banners using raw Prisma
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding banners...')

    const banners = [
        {
            title: 'Gạch Ốp Lát Cao Cấp - Showroom Đông Phú Gia',
            image_url: '/images/banner-1.jpg',
            link_url: '/gach-op-lat',
            is_active: true,
            sort_order: 1,
        },
        {
            title: 'Thiết Bị Vệ Sinh Cao Cấp - TOTO, Inax, Caesar',
            image_url: '/images/banner-2.jpg',
            link_url: '/thiet-bi-ve-sinh',
            is_active: true,
            sort_order: 2,
        },
        {
            title: 'Dự Án Thi Công Nội Thất Tại Đà Lạt',
            image_url: '/images/banner-3.jpg',
            link_url: '/du-an',
            is_active: true,
            sort_order: 3,
        },
    ]

    for (const banner of banners) {
        try {
            await (prisma as any).banners.upsert({
                where: { id: banner.sort_order },
                update: banner,
                create: banner,
            })
            console.log(`✓ Upserted: ${banner.title}`)
        } catch (e: any) {
            // If upsert fails due to id not existing as unique, just create
            await (prisma as any).banners.create({ data: banner })
            console.log(`✓ Created: ${banner.title}`)
        }
    }

    const all = await (prisma as any).banners.findMany()
    console.log(`✅ Done! Total banners in DB: ${all.length}`)
    all.forEach((b: any) => console.log(`  - [${b.id}] ${b.title} → ${b.image_url}`))
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
