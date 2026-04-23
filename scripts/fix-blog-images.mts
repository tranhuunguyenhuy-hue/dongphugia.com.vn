/**
 * fix-blog-images.mts
 * 
 * Replaces broken file:/// image references in blog content with a styled placeholder.
 * Also generates a report of all broken images for manual re-upload.
 * 
 * Usage: npx tsx scripts/fix-blog-images.mts [--dry-run]
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes('--dry-run')

// Placeholder HTML to replace broken file:/// images
const PLACEHOLDER_HTML = `<div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:32px 16px;text-align:center;margin:16px 0;color:#94a3b8;font-size:14px;">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;opacity:0.5;"><path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"/></svg>
  Hình ảnh đang được cập nhật
</div>`

async function main() {
    const posts = await prisma.blog_posts.findMany({
        select: { id: true, slug: true, title: true, content: true }
    })

    console.log(`📰 Found ${posts.length} blog posts total`)
    console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be made\n' : '🔧 LIVE MODE — will update DB\n')

    const report: { slug: string; title: string; images: string[] }[] = []
    let totalFixed = 0

    for (const post of posts) {
        const content = post.content || ''
        
        // Find all file:/// img tags
        const fileImgRegex = /<img[^>]*src=["'](file:\/\/\/[^"']+)["'][^>]*\/?>/gi
        const matches = [...content.matchAll(fileImgRegex)]
        
        if (matches.length === 0) continue

        const brokenUrls = matches.map(m => {
            // Decode the file path for readability
            try { return decodeURIComponent(m[1]) } catch { return m[1] }
        })

        report.push({ slug: post.slug, title: post.title, images: brokenUrls })
        totalFixed += matches.length

        console.log(`📝 ${post.slug}: ${matches.length} broken images`)
        brokenUrls.forEach((url, i) => {
            // Extract just the filename
            const filename = url.split('/').pop() || url
            console.log(`   ${i + 1}. ${filename}`)
        })

        if (!DRY_RUN) {
            // Replace each file:/// img with placeholder
            let fixedContent = content
            fixedContent = fixedContent.replace(fileImgRegex, PLACEHOLDER_HTML)

            await prisma.blog_posts.update({
                where: { id: post.id },
                data: { content: fixedContent }
            })
            console.log(`   ✅ Updated in DB\n`)
        } else {
            console.log(`   ⏭️  Would fix (dry run)\n`)
        }
    }

    console.log('═'.repeat(60))
    console.log(`\n📊 Summary:`)
    console.log(`   Posts affected: ${report.length}`)
    console.log(`   Total broken images: ${totalFixed}`)
    
    if (!DRY_RUN && totalFixed > 0) {
        console.log(`   ✅ All fixed with placeholder`)
    }

    // Generate re-upload manifest
    if (report.length > 0) {
        console.log(`\n📋 RE-UPLOAD MANIFEST (dùng để upload ảnh gốc sau):`)
        console.log('─'.repeat(60))
        for (const r of report) {
            console.log(`\n[${r.slug}] ${r.title}`)
            r.images.forEach((img, i) => {
                const filename = img.split(/[/\\]/).pop() || 'unknown'
                console.log(`  ${i + 1}. ${filename}`)
                console.log(`     Path: ${img}`)
                console.log(`     Upload to: blog/${r.slug}/${filename}`)
            })
        }
    }

    await prisma.$disconnect()
}

main().catch(console.error)
