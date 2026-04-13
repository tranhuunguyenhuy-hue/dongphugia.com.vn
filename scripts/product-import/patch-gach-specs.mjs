/**
 * patch-gach-specs.mjs — LEO-387 Fix: Re-crawl specs with CORRECTED parser
 *
 * PROBLEM: Original crawler only captured 2/14 spec fields due to wrong HTML selectors.
 *
 * ACTUAL HTML STRUCTURE (confirmed via fetch + regex debug):
 *   Main specs:
 *     <div class="product-attribute">
 *       <b class="text-uppercase">LABEL:</b>
 *       <a class="attribute" href="...">VALUE</a>  OR  <span class="attribute">VALUE</span>
 *     </div>
 *   Extended specs (in #collapseContent):
 *     <p><b>LABEL</b>: VALUE</p>
 *     <p><b>LABEL</b>: <span>V1</span>, <span>V2</span></p>  (multi-value)
 *
 * SOLUTION: Re-fetch each product URL, parse with correct selectors, update gach-enriched.json + DB.
 *
 * Usage:
 *   node scripts/product-import/patch-gach-specs.mjs
 *   node scripts/product-import/patch-gach-specs.mjs --limit 5   (test first N)
 *   node scripts/product-import/patch-gach-specs.mjs --resume     (skip already patched)
 *   node scripts/product-import/patch-gach-specs.mjs --dry-run    (no DB/file changes)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env.local') })

// ── CLI ARGS ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const RESUME = args.includes('--resume')
const LIMIT = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : null })()

// ── CONFIG ────────────────────────────────────────────────────────────────────
const DELAY_MIN_MS = 2000
const DELAY_MAX_MS = 3500
const MAX_RETRIES = 3
const BATCH_SAVE = 10

const ENRICHED_FILE = path.join(__dirname, 'gach-enriched.json')
const PATCH_PROGRESS_FILE = path.join(__dirname, 'patch-gach-progress.json')

// ── HELPERS ───────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
function randomDelay() { return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS }

function stripTags(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

function loadPatchProgress() {
  if (!existsSync(PATCH_PROGRESS_FILE)) return { patched: [] }
  try { return JSON.parse(readFileSync(PATCH_PROGRESS_FILE, 'utf-8')) } catch { return { patched: [] } }
}

async function fetchHtml(url, retries = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await delay(5000 * (retries + 1))
      return fetchHtml(url, retries + 1)
    }
    throw err
  }
}

// ── PARSER (CORRECTED) ────────────────────────────────────────────────────────
/**
 * Parse specs from Vietceramics product page HTML.
 *
 * Two sources of spec data:
 * 1. <div class="product-attribute"><b>LABEL:</b><span/a class="attribute">VALUE</span></div>
 * 2. Inside #collapseContent: <p><b>LABEL</b>: VALUE or <span>VAL1</span><span>VAL2</span></p>
 */
function parseSpecsFromHtml(html, collectionName) {
  const raw = {}

  // === SOURCE 1: <div class="product-attribute"> blocks ===
  // Regex: capture entire div content, then extract <b>label</b> and class="attribute" value
  const attrDivRegex = /<div[^>]*class="[^"]*product-attribute[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  let m
  while ((m = attrDivRegex.exec(html)) !== null) {
    const inner = m[1]
    // Label inside <b> tag
    const lb = inner.match(/<b[^>]*>([^<]+)<\/b>/i)
    // Value: prefer class="attribute", fallback to any span/a text
    const vb = inner.match(/class="attribute"[^>]*>\s*([^<\n]+?)\s*<\/(?:a|span)>/i) ||
               inner.match(/<(?:span|a)[^>]*class="[^"]*"[^>]*>\s*([^<\n]+?)\s*<\/(?:span|a)>/i)
    if (lb && vb) {
      const key = lb[1].replace(/:$/, '').trim().toUpperCase().replace(/\s+/g, ' ')
      const val = vb[1].trim().replace(/\s+/g, ' ')
      if (key && val && key.length < 100 && val.length < 200 && !val.includes('javascript')) {
        raw[key] = val
      }
    }
  }

  // === SOURCE 2: #collapseContent — <p><b>LABEL</b>: VALUE</p> ===
  const ci = html.indexOf('collapseContent')
  if (ci !== -1) {
    const collapseHtml = html.substring(ci, ci + 4000)
    const pRegex = /<p[^>]*>\s*<b[^>]*>([^<]+)<\/b>\s*:\s*([\s\S]*?)<\/p>/gi
    let pm
    while ((pm = pRegex.exec(collapseHtml)) !== null) {
      const key = pm[1].trim().toUpperCase().replace(/\s+/g, ' ')
      // Value may contain multiple spans — strip all tags, normalize whitespace
      const val = pm[2].replace(/<[^>]+>/g, ' ').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim()
      // Clean up trailing commas from multi-span rendering
      const cleanVal = val.replace(/,\s*$/, '').trim()
      if (key && cleanVal && key.length < 100 && cleanVal.length < 200 && !cleanVal.includes('javascript')) {
        raw[key] = cleanVal
      }
    }
  }

  // === Map to structured spec fields ===
  const s = {
    bo_suu_tap:             raw['BỘ SƯU TẬP'] || collectionName,
    mau_sac:                raw['MÀU SẮC'] || raw['MÀU SẮC TRONG BỘ SƯU TẬP'] || null,
    so_van:                 raw['SỐ VÂN'] || null,
    quy_cach:               raw['QUY CÁCH'] || raw['KÍCH THƯỚC'] || null,
    kich_thuoc_mo_phong:    raw['KÍCH THƯỚC MÔ PHỎNG'] || null,
    be_mat:                 raw['BỀ MẶT'] || null,
    xuat_xu:                raw['XUẤT XỨ'] || null,
    cong_nghe:              raw['CÔNG NGHỆ'] || null,
    do_chong_truot:         raw['ĐỘ CHỐNG TRƯỢT'] || null,
    chung_chi_moi_truong:   raw['CHỨNG CHỈ THÂN THIỆN VỚI MÔI TRƯỜNG'] || null,
    do_khac_biet_mau_sac:   raw['ĐỘ KHÁC BIỆT MÀU SẮC'] || null,
    don_vi_tinh:            raw['ĐƠN VỊ TÍNH'] || 'm2',
    thiet_ke:               raw['THIẾT KẾ'] || null,
    vi_tri_op_lat:          raw['VỊ TRÍ ỐP LÁT'] || null,
    khu_vuc_op_lat:         raw['KHU VỰC ỐP LÁT'] || null,
    gach_cat_canh:          raw['GẠCH CẮT CẠNH'] || null,
  }

  // Drop nulls and empty strings
  Object.keys(s).forEach(k => { if (!s[k]) delete s[k] })
  return s
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔧 LEO-387 Patch: Fix Specs JSON (Corrected Parser)')
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🔥 LIVE'}${RESUME ? ' + RESUME' : ''}${LIMIT ? ` + LIMIT ${LIMIT}` : ''}`)
  console.log('─'.repeat(60))

  if (!existsSync(ENRICHED_FILE)) {
    console.error('❌ gach-enriched.json not found!')
    process.exit(1)
  }

  const products = JSON.parse(readFileSync(ENRICHED_FILE, 'utf-8'))
  console.log(`📋 Products loaded: ${products.length}`)

  const progress = loadPatchProgress()
  const patchedSkus = new Set(progress.patched || [])
  if (RESUME) console.log(`🔄 Resume: ${patchedSkus.size} already patched`)

  let toProcess = RESUME ? products.filter(p => !patchedSkus.has(p.sku)) : [...products]
  if (LIMIT) toProcess = toProcess.slice(0, LIMIT)
  console.log(`🚀 Will process: ${toProcess.length} products\n`)

  // Lazy Prisma load
  let prisma = null
  if (!DRY_RUN) {
    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient()
  }

  let improved = 0, same = 0, failed = 0

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i]
    const pct = Math.round(((i + 1) / toProcess.length) * 100)
    process.stdout.write(`[${String(i + 1).padStart(3)}/${toProcess.length}] (${String(pct).padStart(3)}%) ${p.sku.padEnd(28)} `)

    if (DRY_RUN) { improved++; process.stdout.write('📝 skipped (dry-run)\n'); continue }

    try {
      const url = p.sourceUrl || `https://vietceramics.com/san-pham/gach-op-lat/${p.collection}/${p.slug}/`
      const html = await fetchHtml(url)
      const newSpecs = parseSpecsFromHtml(html, p.collectionName)
      const oldCount = Object.keys(p.specs || {}).length
      const newCount = Object.keys(newSpecs).length

      // Update in-memory enriched array
      const idx = products.findIndex(x => x.sku === p.sku)
      if (idx !== -1) products[idx].specs = newSpecs

      // Update DB
      await prisma.products.update({ where: { sku: p.sku }, data: { specs: newSpecs } })

      patchedSkus.add(p.sku)

      if (newCount > oldCount) {
        improved++
        process.stdout.write(`✅ ${oldCount}→${newCount} fields\n`)
      } else {
        same++
        process.stdout.write(`ℹ️  ${newCount} fields\n`)
      }

      // Batch save
      if ((i + 1) % BATCH_SAVE === 0 || i === toProcess.length - 1) {
        writeFileSync(ENRICHED_FILE, JSON.stringify(products, null, 2))
        writeFileSync(PATCH_PROGRESS_FILE, JSON.stringify({ patched: [...patchedSkus] }, null, 2))
        console.log(`   💾 Saved checkpoint [${i + 1}/${toProcess.length}]`)
      }

    } catch (err) {
      failed++
      process.stdout.write(`❌ ${err.message}\n`)
    }

    if (i < toProcess.length - 1) await delay(randomDelay())
  }

  // Final save
  if (!DRY_RUN) {
    writeFileSync(ENRICHED_FILE, JSON.stringify(products, null, 2))
    writeFileSync(PATCH_PROGRESS_FILE, JSON.stringify({ patched: [...patchedSkus], done: true }, null, 2))
    await prisma.$disconnect()
  }

  // Summary
  console.log('\n' + '─'.repeat(60))
  console.log('📊 Patch Summary:')
  console.log(`   ✅ Improved (more fields): ${improved}`)
  console.log(`   ℹ️  No change:             ${same}`)
  console.log(`   ❌ Failed:                ${failed}`)

  // Stats
  const final = JSON.parse(readFileSync(ENRICHED_FILE, 'utf-8'))
  const counts = final.map(p => Object.keys(p.specs || {}).length)
  if (counts.length > 0) {
    const avg = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)
    console.log(`\n📊 Specs quality: avg=${avg}, min=${Math.min(...counts)}, max=${Math.max(...counts)} fields/product`)
  }
  console.log('\n✅ Patch complete!')
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1) })
