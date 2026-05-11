import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Fetching Nắp đóng êm products to ungroup...')
    
    // Lấy tất cả sản phẩm đang có variant_group là 'NẮP ĐÓNG ÊM'
    const products = await prisma.products.findMany({
        where: {
            variant_group: 'NẮP ĐÓNG ÊM'
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true
        }
    })

    console.log(`Found ${products.length} lids in the 'NẮP ĐÓNG ÊM' group.`)

    if (products.length === 0) {
        console.log('No products to ungroup.')
        return
    }

    const updates = []
    
    // Cập nhật variant_group = SKU (để mỗi sản phẩm đứng độc lập 1 mình)
    for (const p of products) {
        updates.push(
            prisma.products.update({
                where: { id: p.id },
                data: { variant_group: p.sku }
            })
        )
        console.log(`[UNGROUP] ${p.sku} | ${p.name}`)
    }

    console.log(`\nExecuting ${updates.length} updates...`)
    
    try {
        await prisma.$transaction(updates)
        console.log('✅ Successfully ungrouped all Nắp Đóng Êm!')
    } catch (e) {
        console.error('❌ Failed to update:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
