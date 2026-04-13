/**
 * fix-cdn-images.mjs — LEO-387: Mirror remaining 91 images directly from DB
 *
 * Strategy: Query DB for products with non-CDN image_main_url,
 * download from vietceramics.com, upload to Bunny CDN, update DB records.
 *
 * Usage:
 *   node scripts/product-import/fix-cdn-images.mjs
 *   node scripts/product-import/fix-cdn-images.mjs --limit 5   (test first N)
 *   node scripts/product-import/fix-cdn-images.mjs --resume     (skip already done)
 *   node scripts/product-import/fix-cdn-images.mjs --dry-run    (no uploads/DB changes)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env.local') })

// ── ENV ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '../../.env.local')
  if (!existsSync(envPath)) throw new Error('.env.local not found')
  const content = readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const [key, ...val] = line.split('=')
    if (key && val.length) env[key.trim()] = val.join('=').trim().replace(/^["']|["']$/g, '')
  }
  return env
}

// ── CLI ────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const RESUME = args.includes('--resume')
const LIMIT = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : null })()

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const PROGRESS_FILE = path.join(__dirname, 'fix-cdn-progress.json')
const BATCH_SAVE = 5
const RETRY_COUNT = 3
const DELAY_MS = 1200

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { done: [] }
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')) } catch { return { done: [] } }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function sourceUrlToBunnyPath(url) {
  try {
    const filename = new URL(url).pathname.split('/').pop() || 'image.jpg'
    const clean = decodeURIComponent(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
    return `products/gach-op-lat/${clean}`
  } catch {
    return `products/gach-op-lat/img_${Date.now()}.jpg`
  }
}

async function downloadImage(url, retries = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
        'Referer': 'https://vietceramics.com/',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength < 1000) throw new Error('Image too small (likely error page)')
    return Buffer.from(buffer)
  } catch (err) {
    if (retries < RETRY_COUNT) {
      await sleep(3000 * (retries + 1))
      return downloadImage(url, retries + 1)
    }
    throw err
  }
}

/**
 * Crawl product page to find the real main image URL.
 * Vietceramics uses inconsistent filename patterns — can't guess from SKU.
 * Strategy: find largest /media/images/*.jpg URL in the product page HTML.
 */
async function fetchRealImageUrl(sourceUrl) {
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Referer': 'https://vietceramics.com/',
      }
    })
    if (!res.ok) return null
    const html = await res.text()

    // Priority 1: og:image meta tag
    const ogImg = html.match(/property="og:image"\s+content="([^"]+)"/)
    if (ogImg && ogImg[1].includes('/media/')) {
      const url = ogImg[1].startsWith('http') ? ogImg[1] : `https://vietceramics.com${ogImg[1]}`
      return url
    }

    // Priority 2: First /media/images/*.original.jpg (not logo, not icon)
    const mediaImgs = [...html.matchAll(/\/media\/images\/([^"'\s<>]+\.(?:jpg|jpeg|webp))/gi)]
      .map(m => m[0])
      .filter(u => !u.includes('logo') && !u.includes('icon') && !u.includes('fill-'))
      .filter((v, i, a) => a.indexOf(v) === i)

    // Prefer .original.jpg files
    const original = mediaImgs.find(u => u.includes('.original.'))
    if (original) return `https://vietceramics.com${original}`
    if (mediaImgs[0]) return `https://vietceramics.com${mediaImgs[0]}`

    return null
  } catch {
    return null
  }
}

async function uploadToBunny(buffer, bunnyPath, env, retries = 0) {
  const url = `https://${env.BUNNY_STORAGE_HOSTNAME}/${env.BUNNY_STORAGE_ZONE_NAME}/${bunnyPath}`
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'AccessKey': env.BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Upload failed ${res.status}: ${body}`)
    }
    return `https://${env.BUNNY_CDN_HOSTNAME}/${bunnyPath}`
  } catch (err) {
    if (retries < RETRY_COUNT) {
      await sleep(3000 * (retries + 1))
      return uploadToBunny(buffer, bunnyPath, env, retries + 1)
    }
    throw err
  }
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🖼️  LEO-387 Fix: Mirror Remaining CDN Images')
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🔥 LIVE'}${RESUME ? ' + RESUME' : ''}${LIMIT ? ` + LIMIT ${LIMIT}` : ''}`)
  console.log('─'.repeat(60))

  const env = DRY_RUN ? {
    BUNNY_STORAGE_ZONE_NAME: 'dpg-products',
    BUNNY_STORAGE_HOSTNAME: 'storage.bunnycdn.com',
    BUNNY_CDN_HOSTNAME: 'cdn.dongphugia.com.vn',
    BUNNY_STORAGE_API_KEY: 'dry-run-key',
  } : loadEnv()

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  // Query DB: all gach products with non-CDN image_main_url
  const cat = await prisma.categories.findUnique({ where: { slug: 'gach-op-lat' } })
  const CDN_HOST = env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

  // Find all products that don't have CDN image
  const allProducts = await prisma.products.findMany({
    where: { category_id: cat.id },
    include: { product_images: true, brands: true },
  })

  const needsMirror = allProducts.filter(p =>
    p.image_main_url && !p.image_main_url.includes(CDN_HOST)
  )

  console.log(`📦 Total gach products: ${allProducts.length}`)
  console.log(`🖼️  Already on CDN: ${allProducts.length - needsMirror.length}`)
  console.log(`📋 Need mirroring: ${needsMirror.length}`)

  const progress = loadProgress()
  const doneSKUs = new Set(progress.done || [])

  let toProcess = RESUME ? needsMirror.filter(p => !doneSKUs.has(p.sku)) : [...needsMirror]
  if (LIMIT) toProcess = toProcess.slice(0, LIMIT)

  console.log(`🚀 Will process: ${toProcess.length} products\n`)

  if (toProcess.length === 0) {
    console.log('✅ Nothing left to mirror!')
    await prisma.$disconnect()
    return
  }

  let mirrored = 0, failed = 0, failedList = []

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i]
    const pct = Math.round(((i + 1) / toProcess.length) * 100)
    process.stdout.write(`[${String(i + 1).padStart(3)}/${toProcess.length}] (${String(pct).padStart(3)}%) ${p.sku.padEnd(28)} `)

    if (DRY_RUN) {
      mirrored++
      process.stdout.write(`📝 ${p.image_main_url?.split('/').pop()}\n`)
      continue
    }

    try {
      let imageUrl = p.image_main_url
      let buffer

      // Try downloading from stored URL first
      try {
        buffer = await downloadImage(imageUrl)
      } catch (dlErr) {
        // source_url is null in DB — construct from product slug + brand
        const slug = p.slug         // e.g. "gach-120278on02"
        const brand = p.brands?.slug  // e.g. "onyce"
        const constructedUrl = brand
          ? `https://vietceramics.com/san-pham/gach-op-lat/${brand}/${slug}/`
          : null

        const pageUrl = p.source_url || constructedUrl
        if (pageUrl) {
          process.stdout.write(`(crawling...) `)
          await sleep(600)
          const realUrl = await fetchRealImageUrl(pageUrl)
          if (realUrl) {
            imageUrl = realUrl
            buffer = await downloadImage(imageUrl)
          } else {
            throw new Error(`No image found at ${pageUrl}`)
          }
        } else {
          throw dlErr
        }
      }

      const bunnyPath = sourceUrlToBunnyPath(imageUrl)
      const uploadedUrl = await uploadToBunny(buffer, bunnyPath, env)

      // Update DB: image_main_url on product
      await prisma.products.update({
        where: { id: p.id },
        data: { image_main_url: uploadedUrl },
      })

      // Update product_images records (same or related images)
      for (const img of p.product_images) {
        if (img.image_url && !img.image_url.includes(CDN_HOST)) {
          try {
            if (img.image_url === p.image_main_url || img.image_url === imageUrl) {
              await prisma.product_images.update({
                where: { id: img.id },
                data: { image_url: uploadedUrl },
              })
            } else {
              // Try to download and upload the additional image
              try {
                const imgBuffer = await downloadImage(img.image_url)
                const imgPath = sourceUrlToBunnyPath(img.image_url)
                const imgCdn = await uploadToBunny(imgBuffer, imgPath, env)
                await prisma.product_images.update({ where: { id: img.id }, data: { image_url: imgCdn } })
              } catch {
                // Non-fatal: at least update main image
              }
            }
          } catch {
            // Skip individual image errors
          }
        }
      }

      doneSKUs.add(p.sku)
      mirrored++
      process.stdout.write(`✅ ${uploadedUrl.split('/').pop()}\n`)

      // Batch save progress
      if ((i + 1) % BATCH_SAVE === 0 || i === toProcess.length - 1) {
        writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...doneSKUs] }, null, 2))
        console.log(`   💾 Progress saved [${i + 1}/${toProcess.length}]`)
      }

    } catch (err) {
      failed++
      failedList.push(p.sku)
      process.stdout.write(`❌ ${err.message}\n`)
    }

    if (i < toProcess.length - 1) await sleep(DELAY_MS)
  }

  // Final save & report
  writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...doneSKUs], completed: failed === 0 }, null, 2))
  await prisma.$disconnect()

  // Re-check DB
  const { PrismaClient: PC2 } = await import('@prisma/client')
  const prisma2 = new PC2()
  const catFinal = await prisma2.categories.findUnique({ where: { slug: 'gach-op-lat' } })
  const finalProducts = await prisma2.products.findMany({ where: { category_id: catFinal.id } })
  const finalCdn = finalProducts.filter(p => p.image_main_url?.includes(CDN_HOST)).length
  await prisma2.$disconnect()

  console.log('\n' + '─'.repeat(60))
  console.log('📊 Mirror Summary:')
  console.log(`   ✅ Mirrored this run: ${mirrored}`)
  console.log(`   ❌ Failed:           ${failed}`)
  if (failedList.length > 0) console.log(`   Failed SKUs: ${failedList.join(', ')}`)
  console.log(`\n📊 CDN Coverage: ${finalCdn}/${finalProducts.length} (${Math.round(finalCdn/finalProducts.length*100)}%)`)
  console.log('\n✅ Done!')
}

main().catch(e => { console.error('❌ Fatal:', e.message, e.stack); process.exit(1) })
