/**
 * Clean Hita links from product descriptions
 * - Removes <img> tags with src from any hita domain
 * - Unwraps <a href="hita.com.vn/...">text</a> → keeps text, removes href
 * - Removes empty <p></p> paragraphs left behind
 *
 * Run: npx tsx --env-file=.env.local scripts/db/clean-hita-description.mts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const BATCH_SIZE = 200
const DRY_RUN = process.argv.includes('--dry-run')

/** Remove spinner/CDN img tags from hita domains */
function removeHitaImgTags(html: string): string {
    // Remove <img> tags with src pointing to any hita domain
    return html.replace(
        /<img[^>]*\bsrc=["']https?:\/\/[^"']*hita[^"']*["'][^>]*\/?>/gi,
        ''
    )
}

/** Unwrap hita hyperlinks: keep text content, remove href */
function unwrapHitaLinks(html: string): string {
    // <a href="https://hita.com.vn/...">visible text</a>  →  visible text
    // Uses 'g' + 's' flags (dotAll) for multi-line spans
    let result = html
    let prev = ''
    // Loop until stable (handles nested or back-to-back)
    while (prev !== result) {
        prev = result
        result = result.replace(
            /<a\b[^>]*\bhref=["']https?:\/\/[^"']*hita\.com\.vn[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
            '$1'
        )
    }
    return result
}

/** Remove empty paragraph tags */
function removeEmptyParagraphs(html: string): string {
    return html
        .replace(/<p>\s*<\/p>/gi, '')
        .replace(/<p class="[^"]*">\s*<\/p>/gi, '')
}

function sanitizeDescription(html: string): string {
    let result = html
    result = removeHitaImgTags(result)
    result = unwrapHitaLinks(result)
    result = removeEmptyParagraphs(result)
    return result
}

async function main() {
    console.log(`🚀 Hita Description Cleanup ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}\n`)

    // Count total affected
    const totalResult = await db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM products
        WHERE description ILIKE '%hita%'
    `
    const total = Number(totalResult[0].count)
    console.log(`📊 Products with hita in description: ${total}`)
    console.log(`📦 Batch size: ${BATCH_SIZE}\n`)

    let lastId = 0
    let updatedCount = 0
    let skippedCount = 0
    let totalCharsRemoved = 0
    let processed = 0

    while (true) {
        const batch = await db.$queryRaw<Array<{ id: number; description: string }>>`
            SELECT id, description FROM products
            WHERE id > ${lastId}
              AND description ILIKE '%hita%'
            ORDER BY id
            LIMIT ${BATCH_SIZE}
        `

        if (batch.length === 0) break

        const updates: Array<{ id: number; newDesc: string }> = []

        for (const product of batch) {
            if (!product.description) { skippedCount++; continue }
            const cleaned = sanitizeDescription(product.description)
            if (cleaned !== product.description) {
                const removed = product.description.length - cleaned.length
                totalCharsRemoved += removed
                updates.push({ id: product.id, newDesc: cleaned })
            } else {
                skippedCount++
            }
            lastId = product.id
        }

        if (!DRY_RUN && updates.length > 0) {
            for (const u of updates) {
                await db.products.update({
                    where: { id: u.id },
                    data: { description: u.newDesc },
                })
            }
        }

        updatedCount += updates.length
        processed += batch.length
        process.stdout.write(`\r  Processed: ${processed}/${total} | Updated: ${updatedCount} | Chars removed: ${totalCharsRemoved}`)

        if (batch.length < BATCH_SIZE) break
    }


    console.log('\n')
    console.log('=== Results ===')
    console.log(`✅ Products updated:   ${updatedCount}`)
    console.log(`⏭️  Products unchanged: ${skippedCount}`)
    console.log(`✂️  Total chars removed: ${totalCharsRemoved.toLocaleString()}`)

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN — no changes written to DB')
        console.log('Run without --dry-run to apply changes')
    }

    // Verification
    if (!DRY_RUN) {
        console.log('\n🔍 Verification...')
        const remaining = await db.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM products
            WHERE description ILIKE '%hita.com.vn/images/original%'
               OR description ILIKE '%<img%hita%'
        `
        const imgRemaining = Number(remaining[0].count)
        console.log(`  Spinner/img hita remaining: ${imgRemaining} ${imgRemaining === 0 ? '✅' : '❌'}`)

        const linksRemaining = await db.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM products
            WHERE description ILIKE '%href%hita.com.vn%'
        `
        const linkCount = Number(linksRemaining[0].count)
        console.log(`  Hita href links remaining:  ${linkCount} ${linkCount === 0 ? '✅' : '⚠️ (some may be expected)'}`)
    }

    await db.$disconnect()
    console.log('\n✅ Done!')
}

main().catch(async (err) => {
    console.error('Fatal:', err.message)
    await db.$disconnect()
    process.exit(1)
})
