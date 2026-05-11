import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Thêm các màu mới cho chậu TOTO Galalato...")
    
    // 1. Thêm màu mới
    const newColors = [
        { name: 'Cam Đất', slug: 'cam-dat', hex_code: '#C36A4A' },
        { name: 'Xanh Lá', slug: 'xanh-la', hex_code: '#3D5A45' },
        { name: 'Xanh Xám', slug: 'xanh-xam', hex_code: '#5D7B89' },
        { name: 'Vàng Mù Tạt', slug: 'vang-mu-tat', hex_code: '#D3A33A' }
    ]

    for (const c of newColors) {
        await prisma.colors.upsert({
            where: { slug: c.slug },
            update: { hex_code: c.hex_code, name: c.name },
            create: c
        })
    }
    console.log("Đã thêm 4 màu mới thành công.")

    // Lấy lại danh sách màu để lấy ID
    const colors = await prisma.colors.findMany()
    const colorMap = {}
    colors.forEach(c => colorMap[c.slug] = c.id)

    // 2. Map các sản phẩm
    const productsToUpdate = await prisma.products.findMany({
        where: { sku: { contains: '#', endsWith: '' } } // Lấy các sản phẩm có #
    })

    const updates = []
    
    for (const p of productsToUpdate) {
        let newColorId = p.color_id;
        
        if (p.sku.includes('#SCR')) newColorId = colorMap['cam-dat']
        else if (p.sku.includes('#FRG')) newColorId = colorMap['xanh-la']
        else if (p.sku.includes('#ASB')) newColorId = colorMap['xanh-xam']
        else if (p.sku.includes('#MDR')) newColorId = colorMap['vang-mu-tat']
        
        // Nhóm variant group cho các sản phẩm chậu này luôn
        let newVariantGroup = p.variant_group;
        if (['#SCR', '#FRG', '#ASB', '#MDR', '#W'].some(suffix => p.sku.includes(suffix))) {
            newVariantGroup = p.sku.split('#')[0].trim()
        }

        if (newColorId !== p.color_id || newVariantGroup !== p.variant_group) {
            updates.push({
                id: p.id,
                color_id: newColorId,
                variant_group: newVariantGroup
            })
        }
    }

    console.log(`Tìm thấy ${updates.length} sản phẩm cần cập nhật color_id / variant_group.`)

    if (updates.length > 0) {
        await prisma.$transaction(
            updates.map(u => prisma.products.update({
                where: { id: u.id },
                data: { color_id: u.color_id, variant_group: u.variant_group }
            }))
        )
        console.log(`Đã cập nhật thành công ${updates.length} sản phẩm.`)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
