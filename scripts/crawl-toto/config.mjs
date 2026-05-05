/**
 * config.mjs — Shared configuration for TOTO crawl pipeline
 *
 * IMPORTANT: Contains CATEGORY_MAPPING linking Hita categories to DPG database IDs.
 * Also contains product_type classification rules based on product name patterns.
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── DPG DATABASE IDS ────────────────────────────────────────────────────────
// Category + Subcategory IDs matching prisma schema (queried 2026-05-05)
export const DPG_CATEGORIES = {
  TBVS: 1,    // Thiết bị vệ sinh
  BEP: 2,     // Thiết bị bếp
}

export const DPG_SUBCATEGORIES = {
  BON_CAU:         { id: 1,  category_id: 1, slug: 'bon-cau' },
  LAVABO:          { id: 2,  category_id: 1, slug: 'lavabo' },
  SEN_TAM:         { id: 3,  category_id: 1, slug: 'sen-tam' },
  BON_TAM:         { id: 4,  category_id: 1, slug: 'bon-tam' },
  PHU_KIEN_PT:     { id: 5,  category_id: 1, slug: 'phu-kien-phong-tam' },
  VOI_CHAU:        { id: 6,  category_id: 1, slug: 'voi-chau' },
  BON_TIEU:        { id: 7,  category_id: 1, slug: 'bon-tieu' },
  VOI_NUOC:        { id: 8,  category_id: 1, slug: 'voi-nuoc' },
  NAP_BON_CAU:     { id: 9,  category_id: 1, slug: 'nap-bon-cau' },
  VOI_RUA_CHEN:    { id: 10, category_id: 2, slug: 'voi-rua-chen' },
  PHU_KIEN_BC:     { id: 32, category_id: 1, slug: 'phu-kien-bon-cau' },
  THAN_BON_CAU:    { id: 33, category_id: 1, slug: 'than-bon-cau' },
}

// ─── CRAWL TARGETS (with ?pc=50 for full product load) ───────────────────────
// Hita uses ?pc=N param to load N pages (20 products per page).
// pc=50 = 1000 products max, sufficient for all categories.
export const TOTO_CATEGORIES = [
  // Bồn cầu & Nắp (trọng tâm — có biến thể)
  { url: 'https://hita.com.vn/bon-cau-toto-178.html',          pc: 50, type: 'bon-cau',    default_subcategory_id: 1,  default_category_id: 1 },
  { url: 'https://hita.com.vn/nap-bon-cau-thuong-toto-359.html', pc: 50, type: 'nap-dong-em', default_subcategory_id: 9,  default_category_id: 1 },
  { url: 'https://hita.com.vn/nap-rua-co-toto-203.html',       pc: 50, type: 'nap-rua-co',  default_subcategory_id: 9,  default_category_id: 1 },
  { url: 'https://hita.com.vn/nap-bon-cau-thong-minh-toto.html', pc: 50, type: 'nap-dien-tu', default_subcategory_id: 9,  default_category_id: 1 },
  // Lavabo & Vòi
  { url: 'https://hita.com.vn/chau-rua-mat-lavabo-toto-91.html', pc: 50, type: 'lavabo',    default_subcategory_id: 2,  default_category_id: 1 },
  { url: 'https://hita.com.vn/voi-chau-toto-141.html',          pc: 50, type: 'voi-lavabo', default_subcategory_id: 6,  default_category_id: 1 },
  // Sen & Bồn tắm
  { url: 'https://hita.com.vn/sen-tam-nhat-toto-143.html',      pc: 50, type: 'sen-tam',    default_subcategory_id: 3,  default_category_id: 1 },
  { url: 'https://hita.com.vn/bon-tam-toto-150.html',           pc: 50, type: 'bon-tam',    default_subcategory_id: 4,  default_category_id: 1 },
  // Bồn tiểu
  { url: 'https://hita.com.vn/bon-tieu-nam-toto-170.html',      pc: 50, type: 'bon-tieu',   default_subcategory_id: 7,  default_category_id: 1 },
  // Phụ kiện & Bếp
  { url: 'https://hita.com.vn/phu-kien-nha-tam-258.html',       pc: 50, type: 'phu-kien',   default_subcategory_id: 5,  default_category_id: 1, brandFilter: 'toto' },
  { url: 'https://hita.com.vn/voi-rua-chen-bat-283.html',       pc: 50, type: 'voi-chen',   default_subcategory_id: 10, default_category_id: 2, brandFilter: 'toto' },
]

// ─── PRODUCT TYPE CLASSIFICATION RULES ───────────────────────────────────────
// Maps product name patterns → { subcategory_id, product_type, product_sub_type }
// Order matters: first match wins. More specific patterns must come first.
export const PRODUCT_TYPE_RULES = [
  // ── BỒN CẦU (subcategory_id: 1) ──────────────────────────────────────────
  // Bồn cầu thông minh / Neorest
  { pattern: /neorest|thông minh.*bồn|bồn cầu.*thông minh|bồn cầu điện tử/i,
    subcategory_id: 1, product_type: 'bon-cau-thong-minh' },
  // ── THÂN BỒN CẦU (subcategory_id: 33) — MUST be before "treo tường" ────
  { pattern: /thân cầu|thân bồn cầu/i,
    subcategory_id: 33, product_type: null },

  // Bồn cầu treo tường
  { pattern: /treo tường|treo trường|cầu treo/i,
    subcategory_id: 1, product_type: 'bon-cau-treo-tuong' },
  // Bồn cầu 1 khối
  { pattern: /1 khối|một khối|1-khoi/i,
    subcategory_id: 1, product_type: 'bon-cau-1-khoi' },
  // Bồn cầu 2 khối
  { pattern: /2 khối|hai khối|2-khoi/i,
    subcategory_id: 1, product_type: 'bon-cau-2-khoi' },
  // Bồn cầu đặt sàn (generic)
  { pattern: /bồn cầu.*đặt sàn/i,
    subcategory_id: 1, product_type: 'bon-cau-dat-san' },

  // ── NẮP BỒN CẦU (subcategory_id: 9) ──────────────────────────────────────
  // Nắp điện tử / Washlet
  { pattern: /washlet|nắp.*thông minh|nắp.*điện tử|nắp bồn cầu thông minh/i,
    subcategory_id: 9, product_type: 'nap-dien-tu', product_sub_type: 'nap-dien-tu' },
  // Nắp rửa cơ / Eco washer
  { pattern: /rửa cơ|eco washer|nắp rửa cơ/i,
    subcategory_id: 9, product_type: 'nap-rua-co', product_sub_type: 'nap-rua-co' },
  // Nắp đóng êm (thường)
  { pattern: /nắp.*đóng êm|đóng êm|nắp bồn cầu thường|nắp đậy/i,
    subcategory_id: 9, product_type: 'nap-thuong-dong-em', product_sub_type: 'nap-dong-em' },

  // ── PHỤ KIỆN BỒN CẦU (subcategory_id: 32) ───────────────────────────────
  // Két nước âm tường
  { pattern: /két.*âm tường|khung.*âm tường/i,
    subcategory_id: 32, product_type: 'ket-nuoc-am-tuong' },
  // Két nước thường
  { pattern: /^két nước|két nước và nắp/i,
    subcategory_id: 32, product_type: 'ket-nuoc' },
  // Nắp két nước
  { pattern: /nắp két/i,
    subcategory_id: 32, product_type: 'nap-ket-nuoc' },
  // Nắp đậy (phụ kiện)
  { pattern: /nắp đậy nút xả|nắp đậy bồn cầu MB/i,
    subcategory_id: 32, product_type: 'nap-bon-cau' },
  // Van xả, cần giật, phụ kiện bồn cầu khác
  { pattern: /van xả|cần giật|phao.*bồn cầu|bộ xả/i,
    subcategory_id: 32, product_type: 'phu-kien-bon-cau' },
  // Đường vành
  { pattern: /đường vành|rim/i,
    subcategory_id: 32, product_type: 'duong-vanh' },

  // ── LAVABO (subcategory_id: 2) ────────────────────────────────────────────
  // Lavabo âm bàn
  { pattern: /lavabo.*âm bàn|âm bàn.*lavabo|chậu.*âm bàn/i,
    subcategory_id: 2, product_type: 'lavabo-am-ban' },
  // Lavabo bán âm
  { pattern: /lavabo.*bán âm|bán âm.*lavabo|chậu.*bán âm/i,
    subcategory_id: 2, product_type: 'lavabo-ban-am' },
  // Lavabo treo tường
  { pattern: /lavabo.*treo tường|treo tường.*lavabo|chậu.*treo tường/i,
    subcategory_id: 2, product_type: 'lavabo-treo-tuong' },
  // Lavabo đặt bàn
  { pattern: /lavabo.*đặt bàn|đặt bàn.*lavabo|chậu.*đặt bàn/i,
    subcategory_id: 2, product_type: 'lavabo-dat-ban' },
  // Lavabo dương vành
  { pattern: /dương vành|duong vanh/i,
    subcategory_id: 2, product_type: 'duong-vanh' },
  // Chân chậu lavabo
  { pattern: /chân chậu|chân lavabo/i,
    subcategory_id: 2, product_type: 'lavabo' },

  // ── VÒI CHẬU (subcategory_id: 6) ─────────────────────────────────────────
  // Vòi cảm ứng
  { pattern: /vòi.*cảm ứng|cảm ứng.*vòi/i,
    subcategory_id: 6, product_type: 'voi-cam-ung' },
  // Vòi bán tự động
  { pattern: /bán tự động/i,
    subcategory_id: 6, product_type: 'voi-ban-tu-dong' },
  // Vòi nóng lạnh
  { pattern: /vòi.*nóng lạnh|nóng lạnh.*vòi|RUFICE/i,
    subcategory_id: 6, product_type: 'voi-nong-lanh' },
  // Vòi cổ trung
  { pattern: /vòi.*cổ trung|vòi lavabo lạnh/i,
    subcategory_id: 6, product_type: 'voi-co-trung' },
  // Phụ kiện vòi (cổ thoát, ống nối...)
  { pattern: /cổ thoát|ống nối.*vòi|phụ kiện vòi/i,
    subcategory_id: 6, product_type: 'phu-kien-voi' },

  // ── SEN TẮM (subcategory_id: 3) ──────────────────────────────────────────
  // Sen âm tường
  { pattern: /sen.*âm tường|âm tường.*sen|set sen/i,
    subcategory_id: 3, product_type: 'sen-am-tuong' },
  // Sen cây / sen đứng
  { pattern: /sen cây|sen đứng/i,
    subcategory_id: 3, product_type: 'sen-dung' },
  // Củ sen
  { pattern: /củ sen|bộ điều khiển sen/i,
    subcategory_id: 3, product_type: 'cu-sen' },
  // Tay sen
  { pattern: /tay sen/i,
    subcategory_id: 3, product_type: 'tay-sen' },
  // Phụ kiện sen (bát sen, gác sen, thanh trượt, cút nối)
  { pattern: /bát sen|gác sen|thanh trượt|cút nối.*tường|co nối/i,
    subcategory_id: 3, product_type: 'phu-kien', 
    product_sub_type_fn: (name) => {
      if (/bát sen/i.test(name)) return 'bat-sen'
      if (/gác sen/i.test(name)) return 'gac-sen'
      if (/thanh trượt/i.test(name)) return 'thanh-truot'
      return null
    }
  },

  // ── BỒN TẮM (subcategory_id: 4) ──────────────────────────────────────────
  // Bồn tắm massage
  { pattern: /massage|jacuzzi|sục/i,
    subcategory_id: 4, product_type: 'bon-tam-massage' },
  // Bồn tắm xây / góc
  { pattern: /đặt góc|xây|tam giác/i,
    subcategory_id: 4, product_type: 'bon-tam-xay' },
  // Bồn tắm yếm / thường
  { pattern: /bồn tắm|bon tam/i,
    subcategory_id: 4, product_type: 'bon-tam' },

  // ── BỒN TIỂU (subcategory_id: 7) ─────────────────────────────────────────
  { pattern: /bồn tiểu|tiểu nam|tiểu nữ|urinal/i,
    subcategory_id: 7, product_type: null },

  // ── PHỤ KIỆN PHÒNG TẮM (subcategory_id: 5) ──────────────────────────────
  { pattern: /thanh vịn|kệ.*phòng tắm|giá treo|móc áo|hộp giấy|gương.*phòng/i,
    subcategory_id: 5, product_type: null },

  // ── VÒI RỬA CHÉN (subcategory_id: 10) ────────────────────────────────────
  { pattern: /vòi.*chén|vòi.*bát|vòi bếp|kitchen/i,
    subcategory_id: 10, product_type: null },
]

// ─── CLASSIFY PRODUCT ────────────────────────────────────────────────────────
/**
 * Classify a product by name → { category_id, subcategory_id, product_type, product_sub_type }
 * Falls back to the category default from listing source.
 */
export function classifyProduct(productName, hitaCategoryType) {
  if (!productName) {
    return getDefaultMapping(hitaCategoryType)
  }

  for (const rule of PRODUCT_TYPE_RULES) {
    if (rule.pattern.test(productName)) {
      const sub = Object.values(DPG_SUBCATEGORIES).find(s => s.id === rule.subcategory_id)
      return {
        category_id: sub?.category_id || 1,
        subcategory_id: rule.subcategory_id,
        product_type: rule.product_type || null,
        product_sub_type: rule.product_sub_type
          || (rule.product_sub_type_fn ? rule.product_sub_type_fn(productName) : null)
          || null,
      }
    }
  }

  // Fallback: use default from Hita category
  return getDefaultMapping(hitaCategoryType)
}

function getDefaultMapping(hitaCategoryType) {
  const cat = TOTO_CATEGORIES.find(c => c.type === hitaCategoryType)
  return {
    category_id: cat?.default_category_id || 1,
    subcategory_id: cat?.default_subcategory_id || 1,
    product_type: null,
    product_sub_type: null,
  }
}

// ─── RATE LIMITING ───────────────────────────────────────────────────────────
export const DELAY_MIN_MS = 2000
export const DELAY_MAX_MS = 3500
export const MAX_RETRIES = 3
export const RETRY_DELAY_MS = 5000

// ─── PATHS ───────────────────────────────────────────────────────────────────
export const PATHS = {
  output: path.join(__dirname, 'output'),
  listing: path.join(__dirname, 'output', 'toto-listing.json'),
  enriched: path.join(__dirname, 'output', 'toto-enriched.json'),
  expanded: path.join(__dirname, 'output', 'toto-expanded.json'),
  imageMap: path.join(__dirname, 'output', 'toto-image-map.json'),
  progress: path.join(__dirname, 'output', 'crawl-progress.json'),
}

// ─── IMAGE FILTER ────────────────────────────────────────────────────────────
export function isValidProductImage(src) {
  if (!src || typeof src !== 'string') return false
  // ❌ Exclude non-product images
  if (src.includes('placeholder')) return false
  if (src.includes('icon')) return false
  if (src.includes('banner')) return false
  if (src.includes('widget')) return false
  if (src.includes('/avatar/')) return false
  if (src.includes('/review/')) return false
  if (src.includes('/user/')) return false
  if (src.endsWith('.svg')) return false
  // Check minimum size hint (skip tiny icons/badges)
  const sizeMatch = src.match(/(\d+)x(\d+)/)
  if (sizeMatch && parseInt(sizeMatch[1]) < 50) return false
  // ✅ Only accept product images from Hita CDN
  if (src.includes('cdn.hita.com.vn/storage/products/')) return true
  if (src.includes('cdn.hita.com.vn/storage/gallery/')) return true
  return false
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function randomDelay() {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS
}

export function extractHitaId(url) {
  // Extract numeric ID from Hita URLs like: bon-cau-toto-ms885dt8-4180.html → 4180
  const match = url.match(/-(\d+)\.html/)
  return match ? match[1] : null
}

export async function fetchWithRetry(url, retries = MAX_RETRIES) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
      if (response.status === 404) return { status: 404, html: null }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const html = await response.text()
      return { status: response.status, html }
    } catch (e) {
      if (attempt === retries) return { status: 0, html: null, error: e.message }
      console.log(`    Retry ${attempt}/${retries}: ${e.message}`)
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

export function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '../../', envFile)
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const val = match[2].trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = val
        }
      }
      return
    }
  }
}
