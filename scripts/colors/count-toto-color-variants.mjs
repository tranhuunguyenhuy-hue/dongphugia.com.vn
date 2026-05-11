import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })
    
    if (!totoBrand) return

    const totoProducts = await prisma.products.findMany({
        where: { 
            brand_id: totoBrand.id,
            variant_group: { not: null }
        },
        select: {
            id: true,
            sku: true,
            variant_group: true,
            color_id: true
        }
    })

    const groups = {}
    for (const p of totoProducts) {
        if (!groups[p.variant_group]) groups[p.variant_group] = []
        groups[p.variant_group].push(p)
    }

    let colorVariantGroups = 0
    let colorVariantProducts = 0
    const exampleGroups = []

    for (const groupName in groups) {
        const productsInGroup = groups[groupName]
        if (productsInGroup.length > 1) {
            // Count unique colors in this group
            const uniqueColors = new Set()
            for (const p of productsInGroup) {
                if (p.color_id !== null) {
                    uniqueColors.add(p.color_id)
                }
            }
            
            // If there's more than 1 distinct color, it's a color variant group!
            if (uniqueColors.size > 1) {
                colorVariantGroups++
                colorVariantProducts += productsInGroup.length
                
                if (exampleGroups.length < 5) {
                    exampleGroups.push({
                        group: groupName,
                        skus: productsInGroup.map(p => p.sku).join(', '),
                        colors: Array.from(uniqueColors)
                    })
                }
            }
        }
    }

    console.log(`Có ${colorVariantGroups} mẫu sản phẩm (mã gốc) TOTO có biến thể về màu sắc (có từ 2 màu trở lên).`)
    console.log(`Tổng số lượng các sản phẩm con (các biến thể) thuộc các mẫu này là: ${colorVariantProducts}`)

    console.log("\nVí dụ 5 mẫu sản phẩm có biến thể màu sắc thực sự:")
    exampleGroups.forEach(eg => {
        console.log(`- Mã gốc: ${eg.group}`)
        console.log(`  Các biến thể: ${eg.skus}`)
        console.log(`  Color IDs: ${eg.colors.join(', ')}`)
    })
}

main().finally(() => prisma.$disconnect())
