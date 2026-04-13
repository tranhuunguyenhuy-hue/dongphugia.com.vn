/**
 * mirror-images-gach.mjs — Mirror Gạch Vietceramics images to Bunny CDN
 * 
 * Đọc từ gach-enriched.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

const args = process.argv.slice(2)
const RESUME = args.includes('--resume')
const DRY_RUN = args.includes('--dry-run')

const DOWNLOAD_CONCURRENCY = 3
const RETRY_COUNT = 3
const RETRY_DELAY_MS = 3000

const INPUT_FILE = path.join(__dirname, 'gach-enriched.json')
const URL_MAP_FILE = path.join(__dirname, 'image-url-map-gach.json')
const MIRROR_PROGRESS_FILE = path.join(__dirname, 'mirror-progress-gach.json')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function loadJsonFile(filePath) {
  if (!existsSync(filePath)) return {}
  try { return JSON.parse(readFileSync(filePath, 'utf-8')) } catch { return {} }
}

function vietceramicsUrlToBunnyPath(url) {
  try {
    const rawFilename = new URL(url).pathname.split('/').pop() || 'image.jpg'
    // Decode if needed and clean
    const filename = decodeURIComponent(rawFilename).replace(/[^a-zA-Z0-9.-]/g, '_')
    return `products/gach-op-lat/${filename}`
  } catch {
    const filename = url.split('/').pop() || 'image.jpg'
    return `products/gach-op-lat/unknown_${Date.now()}_${filename}`
  }
}

async function downloadImage(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'image/webp,image/avif,image/*,*/*',
    'Referer': 'https://vietceramics.com/',
  }
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url.replace(/ /g, '%20'), { headers, signal: AbortSignal.timeout(30000) })
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
      if (!res.ok) throw new Error(`Bunny HTTP ${res.status}: ${await res.text()}`)
      return { ok: true }
    } catch (e) {
      if (attempt === RETRY_COUNT) return { ok: false, error: e.message }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

async function mirrorImage(sourceUrl, config, urlMap, dryRun) {
  if (urlMap[sourceUrl]) return { status: 'skipped', bunnyUrl: urlMap[sourceUrl] }

  const storagePath = vietceramicsUrlToBunnyPath(sourceUrl)
  const bunnyUrl = `https://${config.BUNNY_CDN_HOSTNAME}/${storagePath}`

  if (dryRun) {
    urlMap[sourceUrl] = bunnyUrl
    return { status: 'dry-run', bunnyUrl }
  }

  const download = await downloadImage(sourceUrl)
  if (!download.ok) return { status: download.status === 404 ? 'not_found' : 'download_failed', error: download.error }

  const upload = await uploadToBunny(download.buffer, storagePath, download.contentType, config)
  if (!upload.ok) return { status: 'upload_failed', error: upload.error }

  urlMap[sourceUrl] = bunnyUrl
  return { status: 'mirrored', bunnyUrl }
}

async function processBatch(entries, config, urlMap, progress) {
  const results = { mirrored: 0, skipped: 0, failed: 0, notFound: 0 }
  for (let i = 0; i < entries.length; i += DOWNLOAD_CONCURRENCY) {
    const chunk = entries.slice(i, i + DOWNLOAD_CONCURRENCY)
    const promises = chunk.map(entry => mirrorImage(entry.url, config, urlMap, DRY_RUN))
    const chunkResults = await Promise.all(promises)

    for (const r of chunkResults) {
      if (r.status === 'mirrored' || r.status === 'dry-run') results.mirrored++
      else if (r.status === 'skipped') results.skipped++
      else if (r.status === 'not_found') results.notFound++
      else results.failed++
    }

    if ((i + DOWNLOAD_CONCURRENCY) % 30 === 0 || i + DOWNLOAD_CONCURRENCY >= entries.length) {
      const done = Math.min(i + DOWNLOAD_CONCURRENCY, entries.length)
      console.log(`  [${done}/${entries.length}] mirrored:${results.mirrored} skip:${results.skipped} fail:${results.failed}`)
      writeFileSync(URL_MAP_FILE, JSON.stringify(urlMap, null, 2))
      writeFileSync(MIRROR_PROGRESS_FILE, JSON.stringify({ ...progress, lastIndex: i }, null, 2))
    }
  }
  return results
}

async function main() {
  console.log('🖼️  Image Mirror - Gạch Vietceramics')
  
  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ Không tìm thấy ${INPUT_FILE}. Chờ crawler chạy xong.`)
    process.exit(1)
  }

  let config = DRY_RUN ? {
    BUNNY_STORAGE_ZONE_NAME: 'dpg-products',
    BUNNY_STORAGE_HOSTNAME: 'storage.bunnycdn.com',
    BUNNY_CDN_HOSTNAME: 'cdn.dongphugia.com.vn',
  } : loadEnv()

  const urlMap = RESUME ? loadJsonFile(URL_MAP_FILE) : {}
  const progress = loadJsonFile(MIRROR_PROGRESS_FILE)

  const products = loadJsonFile(INPUT_FILE)
  if (!Array.isArray(products)) {
    console.error('❌ Dữ liệu không hợp lệ')
    return
  }

  const allEntries = []
  for (const p of products) {
    if (p.imageMain) allEntries.push({ url: p.imageMain, sku: p.sku })
    if (p.images) {
      for (const img of p.images) {
         if (img.url) allEntries.push({ url: img.url, sku: p.sku })
      }
    }
  }

  const seen = new Set()
  const uniqueEntries = allEntries.filter(e => {
    if (seen.has(e.url)) return false
    seen.add(e.url)
    return true
  })

  console.log(`  Total images: ${uniqueEntries.length}`)
  const toProcess = uniqueEntries.filter(e => RESUME ? !urlMap[e.url] : true)
  
  if (toProcess.length === 0) {
    console.log('✅ Đã mirror xong toàn bộ.')
    return
  }

  const startTime = Date.now()
  const results = await processBatch(toProcess, config, urlMap, progress)
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  writeFileSync(URL_MAP_FILE, JSON.stringify(urlMap, null, 2))
  writeFileSync(MIRROR_PROGRESS_FILE, JSON.stringify({ completed: true }, null, 2))

  console.log(`\n✅ Completed in ${elapsed}min. Mirrored: ${results.mirrored}, Failed: ${results.failed}`)
}

main().catch(console.error)
