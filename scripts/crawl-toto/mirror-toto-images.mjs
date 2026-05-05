/**
 * mirror-toto-images.mjs — Mirror TOTO images & documents from HITA CDN → Bunny CDN
 *
 * Reads toto-enriched.json, downloads gallery images + PDF/DWG documents,
 * uploads to Bunny.net Storage, generates URL mapping file.
 *
 * Usage:
 *   node scripts/crawl-toto/mirror-toto-images.mjs                # mirror all
 *   node scripts/crawl-toto/mirror-toto-images.mjs --resume       # skip already done
 *   node scripts/crawl-toto/mirror-toto-images.mjs --dry-run      # count only
 *   node scripts/crawl-toto/mirror-toto-images.mjs --docs-only    # only PDF/DWG
 *
 * Output: scripts/crawl-toto/output/toto-image-map.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PATHS, isValidProductImage, sleep, loadEnv } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const RESUME = args.includes('--resume')
const DRY_RUN = args.includes('--dry-run')
const DOCS_ONLY = args.includes('--docs-only')

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONCURRENCY = 3
const RETRY_COUNT = 3
const RETRY_DELAY_MS = 3000
const MIRROR_PROGRESS_FILE = path.join(__dirname, 'output', 'mirror-progress.json')

// ─── ENV ─────────────────────────────────────────────────────────────────────
loadEnv()
const BUNNY_CONFIG = {
  BUNNY_STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME,
  BUNNY_STORAGE_API_KEY: process.env.BUNNY_STORAGE_API_KEY,
  BUNNY_STORAGE_HOSTNAME: process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com',
  BUNNY_CDN_HOSTNAME: process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn',
}

// ─── URL CONVERSION ──────────────────────────────────────────────────────────
function hitaUrlToBunnyPath(hitaUrl, type = 'image') {
  try {
    const url = new URL(hitaUrl)
    let pathname = url.pathname.replace(/^\/storage\//, '').replace(/^\/download\?path=/, '')
    // Ensure products/ prefix
    if (!pathname.startsWith('products/')) pathname = `products/${pathname}`
    // For documents, keep in docs/ subfolder
    if (type === 'document') {
      pathname = pathname.replace(/^products\//, 'documents/')
    }
    return pathname
  } catch {
    const filename = hitaUrl.split('/').pop() || 'file'
    return `products/toto/unknown/${filename}`
  }
}

// ─── DOWNLOAD & UPLOAD ──────────────────────────────────────────────────────
async function downloadFile(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Accept': '*/*',
    'Referer': 'https://hita.com.vn/',
  }
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) })
      if (!res.ok) {
        if (res.status === 404) return { ok: false, status: 404 }
        throw new Error(`HTTP ${res.status}`)
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      return { ok: true, buffer, contentType }
    } catch (e) {
      if (attempt === RETRY_COUNT) return { ok: false, error: e.message }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

async function uploadToBunny(buffer, storagePath, contentType) {
  const url = `https://${BUNNY_CONFIG.BUNNY_STORAGE_HOSTNAME}/${BUNNY_CONFIG.BUNNY_STORAGE_ZONE_NAME}/${storagePath}`
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'AccessKey': BUNNY_CONFIG.BUNNY_STORAGE_API_KEY,
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
        },
        body: buffer,
        signal: AbortSignal.timeout(120000),
      })
      if (!res.ok) throw new Error(`Bunny ${res.status}: ${await res.text()}`)
      return { ok: true }
    } catch (e) {
      if (attempt === RETRY_COUNT) return { ok: false, error: e.message }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

// ─── COLLECT ALL ASSETS ──────────────────────────────────────────────────────
function collectAssets(products) {
  const assets = []
  const seen = new Set()

  for (const p of products) {
    if (p.crawl_status !== 'success') continue

    // Gallery images
    if (!DOCS_ONLY && p.gallery_images) {
      for (const imgUrl of p.gallery_images) {
        if (!imgUrl || seen.has(imgUrl)) continue
        // Extra filter: skip non-product images
        if (imgUrl.includes('icon-pdf')) continue
        if (imgUrl.includes('original.jpg')) continue
        if (imgUrl.includes('placeholder')) continue
        if (imgUrl.includes('/icon/')) continue
        if (!imgUrl.includes('hita.com.vn')) continue
        seen.add(imgUrl)
        assets.push({ url: imgUrl, type: 'image', hita_id: p.hita_id })
      }
    }

    // Documents (PDF, DWG)
    if (p.documents) {
      for (const doc of p.documents) {
        if (!doc.url || seen.has(doc.url)) continue
        if (!doc.url.includes('hita.com.vn')) continue
        seen.add(doc.url)
        assets.push({ url: doc.url, type: 'document', hita_id: p.hita_id, name: doc.name })
      }
    }
  }

  return assets
}

// ─── PROCESS BATCH ───────────────────────────────────────────────────────────
async function processBatch(batch, urlMap) {
  const results = await Promise.all(batch.map(async (asset) => {
    if (urlMap[asset.url]) return { ...asset, status: 'skipped' }
    
    const storagePath = hitaUrlToBunnyPath(asset.url, asset.type)
    const bunnyUrl = `https://${BUNNY_CONFIG.BUNNY_CDN_HOSTNAME}/${storagePath}`

    if (DRY_RUN) {
      urlMap[asset.url] = bunnyUrl
      return { ...asset, status: 'dry-run', bunnyUrl }
    }

    const download = await downloadFile(asset.url)
    if (!download.ok) {
      return { ...asset, status: download.status === 404 ? 'not_found' : 'download_failed' }
    }

    const upload = await uploadToBunny(download.buffer, storagePath, download.contentType)
    if (!upload.ok) {
      return { ...asset, status: 'upload_failed', error: upload.error }
    }

    urlMap[asset.url] = bunnyUrl
    return { ...asset, status: 'mirrored', bunnyUrl }
  }))

  return results
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🪞 TOTO Image & Document Mirror — Phase 2.3')
  console.log(`   Time: ${new Date().toISOString()}`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : RESUME ? 'RESUME' : 'FRESH'}`)
  if (DOCS_ONLY) console.log('   Docs only: true')
  console.log()

  // Validate env
  if (!DRY_RUN) {
    if (!BUNNY_CONFIG.BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY not set in .env.local')
      process.exit(1)
    }
    if (!BUNNY_CONFIG.BUNNY_STORAGE_ZONE_NAME) {
      console.error('❌ BUNNY_STORAGE_ZONE_NAME not set in .env.local')
      process.exit(1)
    }
  }

  // Load enriched data
  if (!existsSync(PATHS.enriched)) {
    console.error('❌ toto-enriched.json not found. Run crawl-toto-pdp.mjs first.')
    process.exit(1)
  }
  const products = JSON.parse(readFileSync(PATHS.enriched, 'utf-8'))
  console.log(`📂 Loaded ${products.length} products from enriched`)

  // Collect assets
  const assets = collectAssets(products)
  const imageCount = assets.filter(a => a.type === 'image').length
  const docCount = assets.filter(a => a.type === 'document').length
  console.log(`   Images: ${imageCount} unique`)
  console.log(`   Documents: ${docCount} unique`)
  console.log(`   Total: ${assets.length} assets`)

  // Load URL map (for resume)
  const urlMap = RESUME && existsSync(PATHS.imageMap)
    ? JSON.parse(readFileSync(PATHS.imageMap, 'utf-8'))
    : {}
  
  const alreadyDone = Object.keys(urlMap).length
  if (RESUME && alreadyDone > 0) {
    console.log(`   Resume: ${alreadyDone} already mirrored`)
  }

  const toProcess = assets.filter(a => !urlMap[a.url])
  console.log(`\n   🚀 Processing ${toProcess.length} assets...\n`)

  const stats = { mirrored: 0, skipped: alreadyDone, not_found: 0, failed: 0, dryRun: 0 }
  const startTime = Date.now()

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY)
    const results = await processBatch(batch, urlMap)

    for (const r of results) {
      if (r.status === 'mirrored') {
        stats.mirrored++
        process.stdout.write('✅')
      } else if (r.status === 'dry-run') {
        stats.dryRun++
        process.stdout.write('📋')
      } else if (r.status === 'not_found') {
        stats.not_found++
        process.stdout.write('⚠️')
      } else {
        stats.failed++
        process.stdout.write('❌')
      }
    }

    // Save progress every 50 assets
    if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= toProcess.length) {
      writeFileSync(PATHS.imageMap, JSON.stringify(urlMap, null, 2))
      const done = Math.min(i + CONCURRENCY, toProcess.length)
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
      process.stdout.write(` [${done}/${toProcess.length}] ${elapsed}m\n`)
    }
  }

  // Final save
  writeFileSync(PATHS.imageMap, JSON.stringify(urlMap, null, 2))

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log('\n' + '='.repeat(70))
  console.log('📊 MIRROR SUMMARY')
  console.log('='.repeat(70))
  console.log(`  Total assets:   ${assets.length}`)
  console.log(`  Mirrored:       ${stats.mirrored}`)
  console.log(`  Skipped:        ${stats.skipped}`)
  console.log(`  Not found:      ${stats.not_found}`)
  console.log(`  Failed:         ${stats.failed}`)
  if (DRY_RUN) console.log(`  Dry-run:        ${stats.dryRun}`)
  console.log(`  Time:           ${totalTime} minutes`)
  console.log(`  Output:         output/toto-image-map.json`)
  console.log('='.repeat(70))

  console.log('\n✅ Mirror complete! Next: import-toto.mjs')
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
