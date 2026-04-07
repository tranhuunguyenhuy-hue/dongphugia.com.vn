/**
 * mirror-images.mjs — Mirror product images from HITA CDN to Bunny CDN (LEO-370 Phase 4C)
 *
 * Downloads all product images from cdn.hita.com.vn and uploads to Bunny.net Storage.
 * Generates image-url-map.json mapping HITA URLs → Bunny CDN URLs.
 *
 * Usage:
 *   node mirror-images.mjs                        # mirror all categories
 *   node mirror-images.mjs --category tbvs        # single category
 *   node mirror-images.mjs --resume               # skip already-mirrored images
 *   node mirror-images.mjs --dry-run              # count only, no upload
 *
 * Prerequisites:
 *   - BUNNY_STORAGE_ZONE_NAME in .env.local
 *   - BUNNY_STORAGE_API_KEY in .env.local
 *   - BUNNY_STORAGE_HOSTNAME in .env.local (e.g. storage.bunnycdn.com)
 *   - BUNNY_CDN_HOSTNAME in .env.local (e.g. dpg-products.b-cdn.net or cdn.dongphugia.com.vn)
 *
 * Output:
 *   scripts/product-import/image-url-map.json  ← HITA URL → Bunny URL mapping
 *   scripts/product-import/mirror-progress.json ← resume support
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── ENV ─────────────────────────────────────────────────────────────────────
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

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const RESUME = args.includes('--resume')
const DRY_RUN = args.includes('--dry-run')
const CATEGORY_FILTER = (() => {
  const idx = args.indexOf('--category')
  return idx !== -1 ? args[idx + 1]?.toLowerCase() : null
})()

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DOWNLOAD_CONCURRENCY = 3  // parallel downloads (conservative to avoid rate limits)
const RETRY_COUNT = 3
const RETRY_DELAY_MS = 3000

const CATEGORY_CONFIGS = {
  tbvs: path.join(__dirname, 'tbvs-enriched.json'),
  bep: path.join(__dirname, 'bep-enriched.json'),
  nuoc: path.join(__dirname, 'nuoc-enriched.json'),
}

const URL_MAP_FILE = path.join(__dirname, 'image-url-map.json')
const MIRROR_PROGRESS_FILE = path.join(__dirname, 'mirror-progress.json')

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadJsonFile(filePath) {
  if (!existsSync(filePath)) return {}
  try { return JSON.parse(readFileSync(filePath, 'utf-8')) } catch { return {} }
}

// Convert HITA image URL to Bunny storage path
// Input:  https://cdn.hita.com.vn/storage/products/toto/lavabo/lw818-main.jpg
// Output: products/tbvs/toto/lavabo/lw818-main.jpg
function hitaUrlToBunnyPath(hitaUrl, category) {
  try {
    const url = new URL(hitaUrl)
    // Remove /storage/ prefix from path
    let pathname = url.pathname.replace(/^\/storage\//, '')
    // Ensure it starts with products/
    if (!pathname.startsWith('products/')) {
      pathname = `products/${pathname}`
    }
    // Insert category after products/
    pathname = pathname.replace(/^products\//, `products/${category}/`)
    return pathname
  } catch {
    // Fallback: use hash of URL as filename
    const filename = hitaUrl.split('/').pop() || 'image.jpg'
    return `products/${category}/unknown/${filename}`
  }
}

// ─── BUNNY CDN API ────────────────────────────────────────────────────────────
async function downloadImage(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'image/webp,image/avif,image/*,*/*',
    'Referer': 'https://hita.com.vn/',
  }

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
      if (!res.ok) {
        if (res.status === 404) return { ok: false, status: 404 }
        throw new Error(`HTTP ${res.status}`)
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      return { ok: true, buffer, contentType }
    } catch (e) {
      if (attempt === RETRY_COUNT) return { ok: false, error: e.message }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

async function uploadToBunny(buffer, storagePath, contentType, config) {
  const url = `https://${config.BUNNY_STORAGE_HOSTNAME}/${config.BUNNY_STORAGE_ZONE_NAME}/${storagePath}`

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'AccessKey': config.BUNNY_STORAGE_API_KEY,
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
        },
        body: buffer,
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) throw new Error(`Bunny upload HTTP ${res.status}: ${await res.text()}`)
      return { ok: true }
    } catch (e) {
      if (attempt === RETRY_COUNT) return { ok: false, error: e.message }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

// ─── PROCESS SINGLE IMAGE ─────────────────────────────────────────────────────
async function mirrorImage(hitaUrl, category, config, urlMap, dryRun) {
  // Skip if already mirrored
  if (urlMap[hitaUrl]) {
    return { status: 'skipped', bunnyUrl: urlMap[hitaUrl] }
  }

  const storagePath = hitaUrlToBunnyPath(hitaUrl, category)
  const bunnyUrl = `https://${config.BUNNY_CDN_HOSTNAME}/${storagePath}`

  if (dryRun) {
    urlMap[hitaUrl] = bunnyUrl
    return { status: 'dry-run', bunnyUrl }
  }

  // Download from HITA
  const download = await downloadImage(hitaUrl)
  if (!download.ok) {
    return { status: download.status === 404 ? 'not_found' : 'download_failed', error: download.error }
  }

  // Upload to Bunny
  const upload = await uploadToBunny(download.buffer, storagePath, download.contentType, config)
  if (!upload.ok) {
    return { status: 'upload_failed', error: upload.error }
  }

  urlMap[hitaUrl] = bunnyUrl
  return { status: 'mirrored', bunnyUrl }
}

// ─── COLLECT ALL IMAGES FROM ENRICHED JSON ───────────────────────────────────
function collectImagesFromCategory(catKey) {
  const filePath = CATEGORY_CONFIGS[catKey]
  if (!existsSync(filePath)) {
    console.log(`  ⚠️  ${catKey}-enriched.json not found, skipping`)
    return []
  }

  const products = JSON.parse(readFileSync(filePath, 'utf-8'))
  const imageEntries = []

  for (const p of products) {
    if (!p.gallery_images?.length) continue
    for (const imgUrl of p.gallery_images) {
      if (imgUrl && imgUrl.includes('hita.com.vn')) {
        imageEntries.push({ url: imgUrl, category: catKey, sku: p.sku })
      }
    }
  }

  return imageEntries
}

// ─── PROCESS BATCH WITH CONCURRENCY ──────────────────────────────────────────
async function processBatch(entries, config, urlMap, progress) {
  const results = { mirrored: 0, skipped: 0, failed: 0, notFound: 0 }

  for (let i = 0; i < entries.length; i += DOWNLOAD_CONCURRENCY) {
    const chunk = entries.slice(i, i + DOWNLOAD_CONCURRENCY)

    const promises = chunk.map(entry =>
      mirrorImage(entry.url, entry.category, config, urlMap, DRY_RUN)
    )

    const chunkResults = await Promise.all(promises)

    for (const r of chunkResults) {
      if (r.status === 'mirrored' || r.status === 'dry-run') results.mirrored++
      else if (r.status === 'skipped') results.skipped++
      else if (r.status === 'not_found') results.notFound++
      else results.failed++
    }

    // Progress log every 100 images
    if ((i + DOWNLOAD_CONCURRENCY) % 100 === 0 || i + DOWNLOAD_CONCURRENCY >= entries.length) {
      const done = Math.min(i + DOWNLOAD_CONCURRENCY, entries.length)
      console.log(`  [${done}/${entries.length}] mirrored:${results.mirrored} skip:${results.skipped} fail:${results.failed}`)
      // Save URL map + progress periodically
      writeFileSync(URL_MAP_FILE, JSON.stringify(urlMap, null, 2))
      writeFileSync(MIRROR_PROGRESS_FILE, JSON.stringify({ ...progress, lastIndex: i }, null, 2))
    }
  }

  return results
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🖼️  Image Mirror — LEO-370 Phase 4C (Bunny CDN)')
  console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (no upload)' : 'LIVE'}`)
  console.log(`   Resume: ${RESUME}`)
  if (CATEGORY_FILTER) console.log(`   Category: ${CATEGORY_FILTER} only`)
  console.log()

  // Load Bunny config
  let config = {}
  if (!DRY_RUN) {
    try {
      config = loadEnv()
      const required = ['BUNNY_STORAGE_ZONE_NAME', 'BUNNY_STORAGE_API_KEY', 'BUNNY_STORAGE_HOSTNAME', 'BUNNY_CDN_HOSTNAME']
      const missing = required.filter(k => !config[k])
      if (missing.length) {
        console.error(`❌ Missing .env.local keys: ${missing.join(', ')}`)
        console.error('\nAdd to .env.local:')
        console.error('BUNNY_STORAGE_ZONE_NAME=dpg-products')
        console.error('BUNNY_STORAGE_API_KEY=your-api-key')
        console.error('BUNNY_STORAGE_HOSTNAME=storage.bunnycdn.com')
        console.error('BUNNY_CDN_HOSTNAME=cdn.dongphugia.com.vn')
        process.exit(1)
      }
    } catch (e) {
      console.error('❌', e.message)
      process.exit(1)
    }
  } else {
    // Dry-run: use placeholder CDN hostname
    config = {
      BUNNY_STORAGE_ZONE_NAME: 'dpg-products',
      BUNNY_STORAGE_HOSTNAME: 'storage.bunnycdn.com',
      BUNNY_CDN_HOSTNAME: 'cdn.dongphugia.com.vn',
    }
  }

  // Load resume data
  const urlMap = RESUME ? loadJsonFile(URL_MAP_FILE) : {}
  const progress = loadJsonFile(MIRROR_PROGRESS_FILE)
  if (RESUME) console.log(`  📂 Resume: ${Object.keys(urlMap).length} already mirrored\n`)

  // Collect all images
  const catsToRun = CATEGORY_FILTER ? [CATEGORY_FILTER] : ['tbvs', 'bep', 'nuoc']
  let allEntries = []
  for (const cat of catsToRun) {
    const entries = collectImagesFromCategory(cat)
    console.log(`  ${cat.toUpperCase()}: ${entries.length} images to mirror`)
    allEntries = allEntries.concat(entries)
  }

  // Deduplicate by URL
  const seen = new Set()
  const uniqueEntries = allEntries.filter(e => {
    if (seen.has(e.url)) return false
    seen.add(e.url)
    return true
  })

  console.log(`\n  Total unique images: ${uniqueEntries.length}`)
  console.log(`  Already mapped: ${Object.keys(urlMap).length}`)
  const toProcess = uniqueEntries.filter(e => RESUME ? !urlMap[e.url] : true)
  console.log(`  To process: ${toProcess.length}`)

  if (DRY_RUN) {
    console.log('\n  [DRY-RUN] Generating URL map without uploading...')
  }

  if (toProcess.length === 0) {
    console.log('\n✅ All images already mirrored!')
    return
  }

  const startTime = Date.now()
  const results = await processBatch(toProcess, config, urlMap, progress)
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  // Final save
  writeFileSync(URL_MAP_FILE, JSON.stringify(urlMap, null, 2))
  writeFileSync(MIRROR_PROGRESS_FILE, JSON.stringify({ completed: true, totalMapped: Object.keys(urlMap).length }, null, 2))

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 MIRROR SUMMARY')
  console.log('='.repeat(60))
  console.log(`  Mirrored: ${results.mirrored}`)
  console.log(`  Skipped:  ${results.skipped}`)
  console.log(`  Failed:   ${results.failed}`)
  console.log(`  404:      ${results.notFound}`)
  console.log(`  Time:     ${elapsed} min`)
  console.log(`  URL map:  image-url-map.json (${Object.keys(urlMap).length} entries)`)
  console.log('='.repeat(60))
  console.log('\n✅ Run import-v2.mjs next to use updated image URLs')
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
