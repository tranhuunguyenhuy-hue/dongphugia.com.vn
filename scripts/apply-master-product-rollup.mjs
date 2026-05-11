import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Bắt đầu cập nhật cờ is_master cho toàn bộ hệ thống...')

    // Lấy tất cả các nhóm (variant_group khác null)
    const groups = await prisma.products.groupBy({
        by: ['variant_group'],
        where: { variant_group: { not: null } },
        _count: { id: true }
    })

    console.log(`Tìm thấy ${groups.length} nhóm variant_group.`)

    let totalUpdated = 0

    for (const group of groups) {
        if (!group.variant_group) continue;
        
        // Lấy tất cả sản phẩm trong nhóm này
        const items = await prisma.products.findMany({
            where: { variant_group: group.variant_group },
            orderBy: { sku: 'asc' } // Sắp xếp theo mã để kết quả ổn định
        })

        if (items.length <= 1) continue; // Nhóm chỉ có 1 hoặc 0 SP thì kệ nó

        // Tìm sản phẩm gốc (SKU khớp với variant_group)
        let masterId = items.find(i => i.sku === group.variant_group)?.id

        // Nếu không có sản phẩm gốc (ví dụ tất cả đều có hậu tố), lấy sản phẩm đầu tiên
        if (!masterId) {
            masterId = items[0].id
        }

        // Đặt is_master = true cho masterId, và false cho những cái còn lại
        const childIds = items.filter(i => i.id !== masterId).map(i => i.id)

        // Cập nhật DB
        await prisma.products.update({
            where: { id: masterId },
            data: { is_master: true }
        })

        const res = await prisma.products.updateMany({
            where: { id: { in: childIds } },
            data: { is_master: false }
        })

        totalUpdated += res.count
    }

    console.log(`Đã gỡ cờ is_master cho ${totalUpdated} biến thể phụ! Hệ thống Roll-up đã sẵn sàng.`)
}

main().finally(() => prisma.$disconnect())
