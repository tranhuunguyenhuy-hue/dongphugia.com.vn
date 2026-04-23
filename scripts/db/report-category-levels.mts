import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  BÁO CÁO CẤU TRÚC CATEGORY 3 LỚP (product_type & product_sub_type)')
    console.log('═══════════════════════════════════════════════════════════════\n')

    // --- 1. Tổng quan product_type ---
    const totalWithType = await prisma.products.count({
        where: { is_active: true, product_type: { not: null } }
    })
    const totalActive = await prisma.products.count({ where: { is_active: true } })
    console.log('── 1. TỔNG QUAN ──────────────────────────────────────────────')
    console.log(`  Tổng SP active:              ${totalActive}`)
    console.log(`  Có product_type:             ${totalWithType} (${((totalWithType/totalActive)*100).toFixed(1)}%)`)
    console.log(`  Không có product_type:       ${totalActive - totalWithType}\n`)

    // --- 2. Phân bổ product_type theo subcategory ---
    console.log('── 2. PRODUCT_TYPE THEO SUBCATEGORY ──────────────────────────')
    
    const subcategories = await prisma.subcategories.findMany({
        where: { is_active: true },
        orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }],
        include: { categories: { select: { name: true } } }
    })

    for (const sub of subcategories) {
        const total = await prisma.products.count({
            where: { subcategory_id: sub.id, is_active: true }
        })
        if (total === 0) continue

        // Get distinct product_types for this subcategory
        const types = await prisma.products.groupBy({
            by: ['product_type'],
            where: { subcategory_id: sub.id, is_active: true, product_type: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        })

        const withType = types.reduce((sum, t) => sum + t._count.id, 0)
        
        console.log(`\n  📁 ${sub.categories.name} > ${sub.name} (${total} SP)`)
        if (types.length === 0) {
            console.log(`     ❌ Chưa có product_type nào`)
        } else {
            console.log(`     ✅ ${withType}/${total} SP có type | ${types.length} loại:`)
            types.forEach(t => {
                console.log(`        • "${t.product_type}" — ${t._count.id} SP`)
            })
        }
    }

    // --- 3. product_sub_type ---
    console.log('\n\n── 3. PRODUCT_SUB_TYPE ANALYSIS ──────────────────────────────')
    const subTypes = await prisma.products.groupBy({
        by: ['product_sub_type'],
        where: { is_active: true, product_sub_type: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
    })
    if (subTypes.length === 0) {
        console.log('  ❌ Không có SP nào dùng product_sub_type')
    } else {
        console.log(`  ${subTypes.length} giá trị product_sub_type:`)
        subTypes.forEach(t => console.log(`  • "${t.product_sub_type}" — ${t._count.id} SP`))
    }

    // --- 4. Kết luận & Recommendation ---
    console.log('\n\n── 4. KẾT LUẬN ───────────────────────────────────────────────')
    const onlyBonCauHasTypes = subcategories.filter(async s => {
        const t = await prisma.products.count({ where: { subcategory_id: s.id, product_type: { not: null } } })
        return t > 0
    })
    console.log('  Xem kết quả ở Section 2 để biết subcategory nào đã có data lớp 2.')
    console.log('═══════════════════════════════════════════════════════════════')
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
