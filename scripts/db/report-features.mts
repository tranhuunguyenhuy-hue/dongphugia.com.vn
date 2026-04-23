import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
    console.log('═══════════════════════════════════════════════════════')
    console.log('  BÁO CÁO PRODUCT FEATURES — TOÀN BỘ DANH MỤC')
    console.log('═══════════════════════════════════════════════════════\n')

    // --- 1. Tổng quan ---
    const totalProducts = await prisma.products.count({ where: { is_active: true } })
    const withFeatureText = await prisma.products.count({
        where: { is_active: true, features: { not: null }, NOT: { features: '' } }
    })
    const withFeatureValues = await prisma.product_feature_values.findMany({
        select: { product_id: true },
        distinct: ['product_id']
    })
    const featureValueProductIds = new Set(withFeatureValues.map(v => v.product_id))

    console.log('── 1. TỔNG QUAN ──────────────────────────────────────')
    console.log(`  Tổng SP active:                        ${totalProducts}`)
    console.log(`  SP có "features" text (HTML):           ${withFeatureText}`)
    console.log(`  SP có "product_feature_values" (struct): ${featureValueProductIds.size}`)
    console.log(`  SP không có feature nào:                ${totalProducts - withFeatureText}\n`)

    // --- 2. Chi tiết theo Category ---
    console.log('── 2. THEO CATEGORY ──────────────────────────────────')
    const categories = await prisma.categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true }
    })

    for (const cat of categories) {
        const catTotal = await prisma.products.count({
            where: { category_id: cat.id, is_active: true }
        })
        const catWithFeatures = await prisma.products.count({
            where: { category_id: cat.id, is_active: true, features: { not: null }, NOT: { features: '' } }
        })
        const catWithFV = await prisma.product_feature_values.findMany({
            where: { products: { category_id: cat.id, is_active: true } },
            select: { product_id: true },
            distinct: ['product_id']
        })
        const pct = catTotal > 0 ? ((catWithFeatures / catTotal) * 100).toFixed(1) : '0'
        console.log(`\n  📁 ${cat.name} (ID: ${cat.id})`)
        console.log(`     Tổng SP: ${catTotal} | features text: ${catWithFeatures} (${pct}%) | feature_values: ${catWithFV.length}`)
    }

    // --- 3. Chi tiết theo Subcategory ---
    console.log('\n\n── 3. THEO SUBCATEGORY ────────────────────────────────')
    const subcategories = await prisma.subcategories.findMany({
        where: { is_active: true },
        orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }],
        select: { id: true, name: true, category_id: true, categories: { select: { name: true } } }
    })

    for (const sub of subcategories) {
        const subTotal = await prisma.products.count({
            where: { subcategory_id: sub.id, is_active: true }
        })
        if (subTotal === 0) continue

        const subWithFeatures = await prisma.products.count({
            where: { subcategory_id: sub.id, is_active: true, features: { not: null }, NOT: { features: '' } }
        })
        const subWithFV = await prisma.product_feature_values.findMany({
            where: { products: { subcategory_id: sub.id, is_active: true } },
            select: { product_id: true },
            distinct: ['product_id']
        })
        const pct = subTotal > 0 ? ((subWithFeatures / subTotal) * 100).toFixed(1) : '0'
        const bar = '█'.repeat(Math.round(Number(pct) / 5)) + '░'.repeat(20 - Math.round(Number(pct) / 5))
        console.log(`  ${sub.categories.name} > ${sub.name}`)
        console.log(`     ${bar} ${pct}%  (${subWithFeatures}/${subTotal} text | ${subWithFV.length} struct)`)
    }

    // --- 4. Danh sách product_features đã định nghĩa ---
    console.log('\n\n── 4. PRODUCT FEATURES ĐANG CÓ ───────────────────────')
    const features = await prisma.product_features.findMany({
        orderBy: { sort_order: 'asc' },
        include: { _count: { select: { product_feature_values: true } } }
    })
    if (features.length === 0) {
        console.log('  (Chưa có feature nào được định nghĩa)')
    } else {
        for (const f of features) {
            console.log(`  • ${f.name} (slug: ${f.slug}) — ${f._count.product_feature_values} SP`)
        }
    }

    // --- 5. Mẫu features text ---
    console.log('\n\n── 5. MẪU FEATURES TEXT (3 SP đầu) ───────────────────')
    const samples = await prisma.products.findMany({
        where: { features: { not: null }, NOT: { features: '' }, is_active: true },
        select: { name: true, features: true, categories: { select: { name: true } }, subcategories: { select: { name: true } } },
        take: 3
    })
    for (const s of samples) {
        console.log(`\n  📦 ${s.name}`)
        console.log(`     Cat: ${s.categories.name} > ${s.subcategories?.name || 'N/A'}`)
        console.log(`     Features (first 200 chars): ${s.features!.substring(0, 200)}...`)
    }

    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  HẾT BÁO CÁO')
    console.log('═══════════════════════════════════════════════════════')
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
