import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getShowerBaseModel(sku) {
    const parts = sku.split('/').map(p => p.split('#')[0])
    const mixer = parts.find(p => /^(TBG|TBS|TBV|TVSM|DM)/i.test(p))
    if (mixer) return mixer.toUpperCase()
    return parts[0].toUpperCase()
}

async function main() {
    console.log('Fetching TOTO Showers from database...')
    
    // Tìm brand TOTO
    const brand = await prisma.brands.findFirst({
        where: { name: { contains: 'TOTO' } }
    })
    
    if (!brand) return;

    // Tìm các danh mục liên quan đến Sen tắm
    const subcats = await prisma.subcategories.findMany({
        where: {
            name: { contains: 'sen', mode: 'insensitive' }
        }
    })

    const subcatIds = subcats.map(s => s.id)

    // Lấy tất cả Sen tắm TOTO
    const products = await prisma.products.findMany({
        where: {
            brand_id: brand.id,
            subcategory_id: { in: subcatIds }
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true
        }
    })

    console.log(`Found ${products.length} showers. Processing grouping...`)

    if (products.length === 0) {
        return
    }

    const updates = []
    
    for (const p of products) {
        const expectedGroup = getShowerBaseModel(p.sku)
        
        // Cập nhật Database nếu có sự khác biệt
        if (p.variant_group !== expectedGroup) {
            updates.push(
                prisma.products.update({
                    where: { id: p.id },
                    data: { variant_group: expectedGroup }
                })
            )
            console.log(`[UPDATE] ${p.sku} -> Group: ${expectedGroup}`)
        }
    }

    if (updates.length > 0) {
        console.log(`\nExecuting ${updates.length} updates...`)
        try {
            await prisma.$transaction(updates)
            console.log('✅ Successfully applied variant groups to all TOTO Showers!')
        } catch (e) {
            console.error('❌ Failed to update:', e)
        }
    } else {
        console.log('✅ All products are already correctly grouped. No updates needed.')
    }
}

main().finally(() => prisma.$disconnect())
