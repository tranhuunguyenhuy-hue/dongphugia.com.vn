/**
 * Script: cleanup-placeholder-images.mts
 * Purpose: Remove placeholder "dang-cap-nhat-hinh-anh" images from DB
 *
 * Usage:
 *   Preview:  npx tsx --env-file=.env.local scripts/db/cleanup-placeholder-images.mts
 *   Execute:  DRY_RUN=false npx tsx --env-file=.env.local scripts/db/cleanup-placeholder-images.mts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN !== 'false'

async function main() {
    console.log('━'.repeat(60))
    console.log(`🧹 Cleanup Placeholder Images`)
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '🚀 EXECUTE (will delete)'}`)
    console.log('━'.repeat(60))

    // ── 1. Tìm ảnh placeholder trong product_images ──────────────────────────
    const placeholderImages = await prisma.$queryRaw<Array<{
        id: number
        product_id: number
        image_url: string
    }>>`
        SELECT id, product_id, image_url
        FROM product_images
        WHERE image_url ILIKE '%dang-cap-nhat%'
           OR image_url ILIKE '%no-image%'
           OR image_url ILIKE '%noimage%'
           OR image_url ILIKE '%loading-spinner%'
           OR image_url ILIKE '%placeholder%'
        ORDER BY product_id
    `

    console.log(`\n📦 product_images table: ${placeholderImages.length} rows to delete`)
    for (const img of placeholderImages) {
        console.log(`   ID: ${img.id} | product_id: ${img.product_id} | ${img.image_url}`)
    }

    // ── 2. Tìm products có image_main_url là placeholder ───────────────────
    const placeholderProducts = await prisma.$queryRaw<Array<{
        id: number
        sku: string
        name: string
        image_main_url: string
    }>>`
        SELECT id, sku, name, image_main_url
        FROM products
        WHERE image_main_url ILIKE '%dang-cap-nhat%'
           OR image_main_url ILIKE '%no-image%'
           OR image_main_url ILIKE '%noimage%'
           OR image_main_url ILIKE '%loading-spinner%'
           OR image_main_url ILIKE '%placeholder%'
        ORDER BY id
    `

    console.log(`\n🏷️  products.image_main_url: ${placeholderProducts.length} products to set NULL`)
    for (const p of placeholderProducts) {
        console.log(`   ID: ${p.id} | SKU: ${p.sku} | ${p.name.substring(0, 50)}`)
        console.log(`      URL: ${p.image_main_url}`)
    }

    // ── 3. Summary ────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(60))
    console.log(`📊 Summary:`)
    console.log(`   → Sẽ XÓA ${placeholderImages.length} rows từ product_images`)
    console.log(`   → Sẽ SET NULL ${placeholderProducts.length} rows trong products.image_main_url`)

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN — không thay đổi gì.')
        console.log('   Để thực hiện, chạy:')
        console.log('   DRY_RUN=false npx tsx --env-file=.env.local scripts/db/cleanup-placeholder-images.mts')
        await prisma.$disconnect()
        return
    }

    // ── 4. Thực thi xóa ──────────────────────────────────────────────────────
    console.log('\n🚀 Executing cleanup...')

    // Xóa khỏi product_images
    const idsToDelete = placeholderImages.map(img => img.id)
    if (idsToDelete.length > 0) {
        const deleted = await prisma.product_images.deleteMany({
            where: { id: { in: idsToDelete } },
        })
        console.log(`   ✅ Đã xóa ${deleted.count} rows từ product_images`)
    } else {
        console.log(`   ℹ️  Không có rows nào trong product_images cần xóa`)
    }

    // Set NULL image_main_url trong products
    const productIdsToUpdate = placeholderProducts.map(p => p.id)
    if (productIdsToUpdate.length > 0) {
        const updated = await prisma.products.updateMany({
            where: { id: { in: productIdsToUpdate } },
            data: {
                image_main_url: null,
                updated_at: new Date(),
            },
        })
        console.log(`   ✅ Đã set NULL image_main_url cho ${updated.count} products`)
    } else {
        console.log(`   ℹ️  Không có products nào cần update`)
    }

    console.log('\n🎉 Cleanup hoàn tất!')
    await prisma.$disconnect()
}

main().catch(e => {
    console.error('❌ Error:', e)
    prisma.$disconnect()
    process.exit(1)
})
