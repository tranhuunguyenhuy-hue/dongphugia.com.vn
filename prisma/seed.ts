
import { PrismaClient } from '@prisma/client'
import { CATEGORY_DATA } from './seed-data'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // 1. Create Categories
    const categories = [
        { name: 'Gạch ốp lát', slug: 'gach-op-lat' },
        { name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' },
        { name: 'Thiết bị nhà bếp', slug: 'thiet-bi-nha-bep' },
        { name: 'Thiết bị ngành nước', slug: 'thiet-bi-nghanh-nuoc' },
        { name: 'Sàn gỗ - Sàn nhựa', slug: 'san-go-san-nhua' },
    ]

    for (const cat of categories) {
        await prisma.category.upsert({
            where: { slug: cat.slug },
            update: {},
            create: { name: cat.name, slug: cat.slug }
        })
    }

    // 2. Seed 4 New Categories (TBVS, Kitchen, Water, Flooring)
    for (const [slug, data] of Object.entries(CATEGORY_DATA)) {
        const category = await prisma.category.findUnique({ where: { slug } })
        if (!category) continue

        console.log(`Processing category: ${data.name}...`)

        // Create Product Types & Groups
        for (const typeData of data.types) {
            const typeSlug = slugify(typeData.name)

            const type = await prisma.productType.upsert({
                where: { slug: typeSlug },
                update: {},
                create: {
                    name: typeData.name,
                    slug: typeSlug,
                    categoryId: category.id
                }
            })

            // Create Product Groups
            for (const groupName of typeData.groups) {
                const groupSlug = slugify(groupName)
                await prisma.productGroup.upsert({
                    where: { slug: groupSlug },
                    update: {},
                    create: {
                        name: groupName,
                        slug: groupSlug,
                        productTypeId: type.id
                    }
                })
            }
        }
    }

    // 3. Seed Sample Brands for each Category
    const brands = {
        "thiet-bi-ve-sinh": ["TOTO", "Inax", "Caesar", "Viglacera", "American Standard"],
        "thiet-bi-nha-bep": ["Malloca", "Bosch", "Hafele", "Teka", "Eurosun"],
        "thiet-bi-nghanh-nuoc": ["Sơn Hà", "Tân Á Đại Thành", "Ariston", "Ferroli"],
        "gach-op-lat": ["Prime", "Viglacera", "Đồng Tâm", "Eurotile"] // Gạch brands often shared or no specific category enforcement before, but good to add
    }

    for (const [catSlug, brandNames] of Object.entries(brands)) {
        const category = await prisma.category.findUnique({ where: { slug: catSlug } })
        if (!category) continue

        for (const name of brandNames) {
            const brandSlug = slugify(name)
            await prisma.brand.upsert({
                where: { slug: brandSlug },
                update: { categoryId: category.id }, // Update category association
                create: {
                    name,
                    slug: brandSlug,
                    categoryId: category.id
                }
            })
        }
    }

    console.log('✅ Seed finished.')
}

function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD') // Split accents
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
