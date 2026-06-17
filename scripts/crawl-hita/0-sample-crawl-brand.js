/**
 * Sample crawl/audit Hita products by brand and subcategory.
 *
 * Usage:
 *   node scripts/crawl-hita/0-sample-crawl-brand.js --brand=caesar
 *   node scripts/crawl-hita/0-sample-crawl-brand.js --brand=caesar --min=10 --max=20 --candidate-limit=500
 *
 * This script is intentionally separate from the legacy Phase 2 crawler:
 * it produces audit artifacts for taxonomy, filter, PDP, media, price, and
 * variant review. It does not import anything into the database.
 */

import { chromium } from 'playwright';
import pLimit from 'p-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite, parseVND, resolveUrl, sleep, withRetry } from './utils.js';
import { getBrandConfig, parseBrandArg } from './brand-configs.js';
import { lookupCategory } from './category-map.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND_SLUG = parseBrandArg();
const BRAND_CONFIG = getBrandConfig(BRAND_SLUG);

const args = process.argv.slice(2);
const FULL_CRAWL = args.includes('--full');
const SAMPLE_MIN = readNumberArg('--min=', 10);
const SAMPLE_MAX = readNumberArg('--max=', 20);
const CANDIDATE_LIMIT = readNumberArg('--candidate-limit=', FULL_CRAWL ? 5000 : 420);
const CONCURRENCY = readNumberArg('--concurrency=', 2);
const HEADLESS = !args.includes('--headed');
const TARGET_SUBCATEGORY = readStringArgValue('--subcategory=', '');
const OUTPUT_DIR = path.resolve(__dirname, `output/${BRAND_SLUG}`);
const SAMPLE_DIR = readStringArg(
  '--sample-dir=',
  path.join(OUTPUT_DIR, TARGET_SUBCATEGORY ? `sample-${TARGET_SUBCATEGORY}` : (FULL_CRAWL ? 'full-normalized' : 'sample'))
);
const URLS_FILE = path.join(OUTPUT_DIR, 'urls.json');

const BASE_URL = 'https://hita.com.vn';
const MAX_IMAGES = 20;
const VARIANT_EXTRA_CAP_PER_SUBCATEGORY = 8;

const FILTER_KEYS_BY_SUBCATEGORY = {
  'bon-cau': [
    'product_type',
    'product_sub_type',
    'Kiểu bồn cầu',
    'Loại nắp',
    'Kiểu xả',
    'Lượng nước xả',
    'Kiểu thoát',
    'Tâm xả',
    'Màu sắc',
    'Kích thước',
  ],
  lavabo: [
    'product_type',
    'Kiểu lắp',
    'Hình dáng',
    'Chất liệu',
    'Màu sắc',
  ],
  'tu-chau': [
    'product_type',
    'Kiểu lắp đặt',
    'Chất liệu',
    'Màu sắc',
    'Kích thước',
  ],
  'sen-tam': [
    'product_type',
    'Kiểu sen',
    'Chế độ',
    'Số chế độ',
    'Chất liệu',
    'Lớp mạ (màu)',
    'Kích thước bát sen',
  ],
  'voi-chau': [
    'product_type',
    'Chất liệu',
    'Chế độ',
    'Loại vòi',
    'Vị trí lắp vòi',
    'Độ cao vòi',
    'Lớp mạ (màu)',
    'Kiểu lắp vòi',
  ],
  'bon-tam': [
    'product_type',
    'Chiều Dài Bồn Tắm',
    'Tính năng bồn tắm',
    'Chất liệu',
    'Dung Tích',
  ],
  'bon-tieu': [
    'product_type',
    'Kiểu thoát',
    'Kiểu xả',
  ],
  'nap-bon-cau': [
    'product_type',
    'Loại nắp',
    'Tính năng',
    'Màu sắc',
  ],
  'phu-kien-phong-tam': [
    'product_type',
    'Nhóm phụ kiện',
    'Chất liệu',
    'Màu sắc',
    'Kích thước',
  ],
  'than-bon-cau': [
    'product_type',
    'Nhóm linh kiện',
    'Màu sắc',
  ],
  'voi-rua-chen': [
    'product_type',
    'Nguồn nước',
    'Kiểu lắp đặt',
    'Chất liệu',
    'Màu sắc',
  ],
};

const PRODUCT_TYPE_RULES = [
  { subcategory_id: 'bon-cau', product_type: 'bon-cau-treo-tuong', regex: /treo tường/i },
  { subcategory_id: 'bon-cau', product_type: 'bon-cau-xom', regex: /(xí xổm|bồn cầu xổm|bon cau xom)/i },
  { subcategory_id: 'bon-cau', product_type: 'bon-cau-1-khoi', regex: /(1 khối|một khối)/i },
  { subcategory_id: 'bon-cau', product_type: 'bon-cau-2-khoi', regex: /(2 khối|hai khối)/i },
  { subcategory_id: 'bon-cau', product_type: 'bon-cau-dat-san', regex: /(đặt sàn|dat san|van xả trực tiếp|van xa truc tiep)/i },
  { subcategory_id: 'bon-cau', product_type: 'bon-cau-thong-minh', regex: /(bồn cầu thông minh|smart toilet)/i },
  { subcategory_id: 'lavabo', product_type: 'lavabo-am-ban', regex: /âm bàn/i },
  { subcategory_id: 'lavabo', product_type: 'lavabo-ban-am', regex: /bán âm/i },
  { subcategory_id: 'lavabo', product_type: 'lavabo-duong-vanh', regex: /(dương vành|dương bàn)/i },
  { subcategory_id: 'lavabo', product_type: 'lavabo-dat-ban', regex: /(đặt bàn|dat ban)/i },
  { subcategory_id: 'lavabo', product_type: 'lavabo-treo-tuong', regex: /treo tường/i },
  { subcategory_id: 'lavabo', product_type: 'chan-chau-lavabo', regex: /(chân chậu|chan chau)/i },
  { subcategory_id: 'lavabo', product_type: 'tu-chau', regex: /(tủ chậu|tu chau|cabinet|bộ tủ chậu|bo tu chau)/i },
  { subcategory_id: 'sen-tam', product_type: 'bo-sen-cay', regex: /(sen cây|cây tắm)/i },
  { subcategory_id: 'sen-tam', product_type: 'bo-sen-tam', regex: /(bộ vòi sen tắm|bo voi sen tam|bộ sen tắm|bo sen tam)/i },
  { subcategory_id: 'sen-tam', product_type: 'sen-am-tuong', regex: /(âm tường|am tuong)/i },
  { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi', regex: /(phụ kiện sen|dây sen|thanh trượt|gác sen|cút nối|bát sen|đầu phun|đầu sen|van điều chỉnh|van chia nước|khóa nước|ruột vòi)/i },
  { subcategory_id: 'sen-tam', product_type: 'tay-sen', regex: /tay sen/i },
  { subcategory_id: 'sen-tam', product_type: 'cu-sen', regex: /(củ sen|cu sen)/i },
  { subcategory_id: 'sen-tam', product_type: 'van-dieu-chinh', regex: /(van điều chỉnh|van sen)/i },
  { subcategory_id: 'voi-chau', product_type: 'voi-cam-ung', regex: /cảm ứng/i },
  { subcategory_id: 'voi-chau', product_type: 'voi-gan-tuong', regex: /gắn tường/i },
  { subcategory_id: 'voi-chau', product_type: 'voi-nong-lanh', regex: /(nóng lạnh|nong lanh)/i },
  { subcategory_id: 'voi-chau', product_type: 'voi-lanh', regex: /vòi chậu lavabo/i },
  { subcategory_id: 'voi-chau', product_type: 'voi-lanh', regex: /(nước lạnh|lạnh)/i },
  { subcategory_id: 'bon-tam', product_type: 'bon-tam-massage', regex: /massage/i },
  { subcategory_id: 'bon-tam', product_type: 'bon-tam-chan-yem', regex: /(chân yếm|có yếm|yếm)/i },
  { subcategory_id: 'bon-tam', product_type: 'bon-tam-dat-san', regex: /(đặt sàn|dat san)/i },
  { subcategory_id: 'bon-tam', product_type: 'bon-tam-xay', regex: /(bồn tắm xây|bon tam xay|xây bệ|xay be)/i },
  { subcategory_id: 'bon-tam', product_type: 'bon-tam', regex: /(bồn tắm đứng|cửa tắm đứng|lập thể)/i },
  { subcategory_id: 'bon-tam', product_type: 'phu-kien-bon-tam', regex: /(phụ kiện bồn tắm|phu kien bon tam|thanh tay vịn bồn tắm|thanh tay vin bon tam|khay tắm đứng|bộ xả)/i },
  { subcategory_id: 'bon-tieu', product_type: 'van-xa-tieu', regex: /(van xả tiểu|van xa tieu|van xả|van xa)/i },
  { subcategory_id: 'bon-tieu', product_type: 'vach-ngan-tieu-nam', regex: /(vách ngăn tiểu|vach ngan tieu)/i },
  { subcategory_id: 'bon-tieu', product_type: 'bon-tieu-nu', regex: /(bồn tiểu nữ|bon tieu nu)/i },
  { subcategory_id: 'bon-tieu', product_type: 'bon-tieu-nam', regex: /(bồn tiểu nam|bon tieu nam|bồn tiểu|bon tieu)/i },
  { subcategory_id: 'nap-bon-cau', product_type: 'nap-dien-tu', regex: /(điện tử|thông minh|smart)/i },
  { subcategory_id: 'nap-bon-cau', product_type: 'nap-rua-co', regex: /rửa cơ/i },
  { subcategory_id: 'nap-bon-cau', product_type: 'nap-thuong-dong-em', regex: /(nắp bồn cầu|đóng êm|thường)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'pheu-thoat-san', regex: /(phễu thoát|thoát sàn|cầu chắn rác)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'voi-xit-ve-sinh', regex: /vòi xịt/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'thanh-tay-vin', regex: /(thanh tay vịn|thanh tay vin)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'hop-giay-ve-sinh', regex: /(lô giấy|lo giay|hộp đựng giấy|hop dung giay)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'hop-xa-phong', regex: /(hộp xà phòng|hop xa phong|hộp xịt xà phòng|hop xit xa phong|máy rửa tay|may rua tay)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'ke-xa-phong', regex: /(kệ xà phòng|ke xa phong|giá để đĩa xà phòng|kệ góc|kệ inox)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'moc-ao', regex: /(móc áo|moc ao)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'thanh-treo-khan', regex: /(thanh treo khăn|thanh treo khan|thanh vắt khăn|thanh vat khan)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'lo-ban-chai', regex: /(lọ bàn chải|lo ban chai|bàn chải răng)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'guong-phong-tam', regex: /(gương soi|gương nhà tắm|gương trang điểm)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'vong-treo-khan', regex: /vòng treo khăn/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay', regex: /(máy sấy tay|may say tay)/i },
  { subcategory_id: 'phu-kien-phong-tam', product_type: 'phu-kien-khac', regex: /(máy tạo ozon|may tao ozon|kệ kính|cọ vệ sinh|dây phơi|gạt tàn)/i },
  { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau', regex: /(két nước|nắp két|thân két|bộ két|bộ xả|van xả bồn cầu|thân sứ|đế cầu|phụ kiện bồn cầu)/i },
  { subcategory_id: 'than-bon-cau', product_type: 'than-bon-cau', regex: /(thân cầu|thân bồn cầu)/i },
  { subcategory_id: 'voi-rua-chen', product_type: 'voi-rua-chen', regex: /(vòi rửa chén|vòi bếp)/i },
  { subcategory_id: 'chau-rua-chen', product_type: 'chau-rua-chen', regex: /(chậu rửa chén|chau rua chen)/i },
];

const KITCHEN_SUBCATEGORY_IDS = ['voi-rua-chen', 'chau-rua-chen', 'thiet-bi-bep-khac'];

function readNumberArg(prefix, fallback) {
  const arg = args.find((item) => item.startsWith(prefix));
  if (!arg) return fallback;
  const value = Number.parseInt(arg.slice(prefix.length), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStringArg(prefix, fallback) {
  const arg = args.find((item) => item.startsWith(prefix));
  if (!arg) return fallback;
  return path.resolve(process.cwd(), arg.slice(prefix.length));
}

function readStringArgValue(prefix, fallback) {
  const arg = args.find((item) => item.startsWith(prefix));
  if (!arg) return fallback;
  return arg.slice(prefix.length).trim();
}

function loadCandidateUrls() {
  const urls = [];

  for (const url of BRAND_CONFIG.sampleUrls || []) urls.push({ url, source: 'brand-config.sampleUrls' });

  if (fs.existsSync(URLS_FILE)) {
    const discovered = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
    for (const url of interleaveByRoughSubcategory(discovered)) {
      urls.push({ url, source: 'output.urls.json' });
    }
  }

  const seen = new Set();
  return urls
    .map((candidate) => ({ ...candidate, url: normalizeProductUrl(candidate.url) }))
    .filter((candidate) => candidate.url && isLikelyProductUrl(candidate.url))
    .filter((candidate) => !TARGET_SUBCATEGORY || roughSubcategoryFromUrl(candidate.url) === TARGET_SUBCATEGORY)
    .filter((candidate) => {
      if (seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    })
    .sort((a, b) => a.url.localeCompare(b.url))
    .sort((a, b) => compareCandidateCoverage(a.url, b.url))
    .map((candidate) => ({ ...candidate, product_type_bucket: inferProductTypeBucket(candidate.url) }))
    .sort((a, b) => a.product_type_bucket.localeCompare(b.product_type_bucket))
    .reduce((ordered, candidate, _index, all) => {
      if (!TARGET_SUBCATEGORY) {
        ordered.push(candidate);
        return ordered;
      }
      if (ordered.length > 0) return ordered;
      ordered.push(...interleaveCandidatesByBucket(all));
      return ordered;
    }, [])
    .slice(0, CANDIDATE_LIMIT);
}

function compareCandidateCoverage(aUrl, bUrl) {
  if (!TARGET_SUBCATEGORY) return 0;
  const aRank = productTypeBucketRank(aUrl);
  const bRank = productTypeBucketRank(bUrl);
  if (aRank !== bRank) return aRank - bRank;
  return aUrl.localeCompare(bUrl);
}

function productTypeBucketRank(url) {
  const bucketOrder = [
    'bon-cau-1-khoi',
    'bon-cau-2-khoi',
    'bon-cau-treo-tuong',
    'bon-cau-xom',
    'bon-cau-thong-minh',
    'bon-cau-dat-san',
    'phu-kien-bon-cau',
    'other',
  ];
  const matched = inferProductTypeBucket(url);
  const index = bucketOrder.indexOf(matched);
  return index === -1 ? bucketOrder.length - 1 : index;
}

function inferProductTypeBucket(url) {
  const text = decodeURIComponent(url)
    .replace(/[-_/]+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/treo tuong/.test(text)) return 'bon-cau-treo-tuong';
  if (/(xi xom|bon cau xom)/.test(text)) return 'bon-cau-xom';
  if (/(thong minh|smart toilet)/.test(text)) return 'bon-cau-thong-minh';
  if (/(dat san|van xa truc tiep)/.test(text)) return 'bon-cau-dat-san';
  if (/(ket nuoc|nap ket|than ket|bo xa|van xa bon cau|phu kien bon cau)/.test(text)) return 'phu-kien-bon-cau';
  if (/(1 khoi|mot khoi)/.test(text)) return 'bon-cau-1-khoi';
  if (/(2 khoi|hai khoi)/.test(text)) return 'bon-cau-2-khoi';
  return 'other';
}

function interleaveCandidatesByBucket(candidates) {
  const buckets = new Map();
  for (const candidate of candidates) {
    const key = candidate.product_type_bucket || 'other';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(candidate);
  }
  const orderedKeys = [
    'bon-cau-1-khoi',
    'bon-cau-2-khoi',
    'bon-cau-treo-tuong',
    'bon-cau-xom',
    'bon-cau-thong-minh',
    'bon-cau-dat-san',
    'phu-kien-bon-cau',
    'other',
  ].filter((key) => buckets.has(key));
  const result = [];
  let index = 0;
  while (orderedKeys.some((key) => index < buckets.get(key).length)) {
    for (const key of orderedKeys) {
      const bucket = buckets.get(key);
      if (index < bucket.length) result.push(bucket[index]);
    }
    index += 1;
  }
  return result;
}

function interleaveByRoughSubcategory(urls) {
  const buckets = new Map();
  for (const url of urls) {
    const key = roughSubcategoryFromUrl(url) || 'other';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(url);
  }

  const orderedKeys = [
    'bon-cau',
    'lavabo',
    'sen-tam',
    'voi-chau',
    'bon-tam',
    'bon-tieu',
    'nap-bon-cau',
    'phu-kien-phong-tam',
    'phu-kien-bon-cau',
    'than-bon-cau',
    'voi-rua-chen',
    'other',
  ].filter((key) => buckets.has(key));

  const interleaved = [];
  let index = 0;
  while (orderedKeys.some((key) => index < buckets.get(key).length)) {
    for (const key of orderedKeys) {
      const bucket = buckets.get(key);
      if (index < bucket.length) interleaved.push(bucket[index]);
    }
    index += 1;
  }
  return interleaved;
}

function roughSubcategoryFromUrl(url) {
  const lower = url.toLowerCase();
  if (/chau-rua-chen/.test(lower)) return 'chau-rua-chen';
  if (/voi-(rua-chen|bep)/.test(lower)) return 'voi-rua-chen';
  if (/(than-bon-cau|than-su-cau|than-cau)/.test(lower)) return 'than-bon-cau';
  if (/(nap-bon-cau|nap-rua)/.test(lower)) return 'nap-bon-cau';
  if (/(ket-nuoc|bo-xa-bon-cau|nap-ket-nuoc|van-xa-bon-cau|phu-kien-bon-cau)/.test(lower)) return 'bon-cau';
  if (/(pheu-thoat|voi-xit|lo-giay|hop-giay|thanh-treo|phu-kien|ke-xa-phong|hop-xa-phong|moc-ao|may-say-tay)/.test(lower)) return 'phu-kien-phong-tam';
  if (/bon-tieu/.test(lower)) return 'bon-tieu';
  if (/bon-tam/.test(lower)) return 'bon-tam';
  if (/(sen|bat-sen|tay-sen|dau-phun)/.test(lower)) return 'sen-tam';
  if (/(voi-lavabo|voi-chau)/.test(lower)) return 'voi-chau';
  if (/(lavabo|chau-rua|tu-chau|tu-lavabo)/.test(lower)) return 'lavabo';
  if (/bon-cau/.test(lower)) return 'bon-cau';
  return null;
}

function normalizeProductUrl(rawUrl) {
  if (!rawUrl) return '';
  const url = resolveUrl(rawUrl, BASE_URL).split('#')[0];
  return url.split('?')[0];
}

function isLikelyProductUrl(url) {
  if (!url.startsWith(BASE_URL) || !url.endsWith('.html')) return false;
  const match = url.match(/-(\d+)\.html$/);
  return Boolean(match && Number(match[1]) >= 1000);
}

async function crawlProduct(context, candidate) {
  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    await withRetry(async () => {
      await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    });

    const raw = await page.evaluate(({ baseUrl, maxImages }) => {
      const text = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
      const html = (selector) => document.querySelector(selector)?.innerHTML?.trim() || '';
      const abs = (value) => {
        if (!value) return '';
        try { return new URL(value, baseUrl).href.split('#')[0].split('?')[0]; } catch { return ''; }
      };
      const absWithQuery = (value) => {
        if (!value) return '';
        try { return new URL(value, baseUrl).href.split('#')[0]; } catch { return ''; }
      };
      const ownText = (node) => node?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const productUrl = window.location.href.split('#')[0].split('?')[0];

      const priceRoot =
        document.querySelector('#main-price-product') ||
        document.querySelector('.product-price') ||
        document.querySelector('.price-box');

      const breadcrumb = [...document.querySelectorAll('.breadcrumb a[href], nav[aria-label*="breadcrumb"] a[href], .breadcrumbs a[href]')]
        .map((a) => ({
          text: ownText(a),
          href: abs(a.getAttribute('href')),
        }))
        .filter((item) => item.href);

      const skuCandidates = [
        text('.product-sku'),
        text('.product-code'),
        text('[class*="sku"]'),
        text('[class*="code"]'),
      ].filter(Boolean);

      const name = text('h1');
      const earlySku = normalizeSku(skuCandidates, {}, name);
      const priceBlockText = ownText(priceRoot);
      const bodyText = ownText(document.body);
      const statusText = ownText(document.querySelector('.product-status, .label-status, [class*="product-status"], [class*="stock-status"]'));
      const inactive = /ngưng hoạt động|ngung hoat dong|ngừng kinh doanh|ngung kinh doanh/i.test(`${statusText} ${priceBlockText} ${name} ${bodyText.slice(0, 1500)}`);

      const descriptionRoot = findDescriptionRoot();
      const descriptionRawHtml = extractRawDescriptionHtml(descriptionRoot);
      const descriptionCleanRoot = findDescriptionCleanRoot(descriptionRoot);
      const cleanResult = cleanDescription(descriptionCleanRoot, earlySku);

      const specs = {};
      for (const row of document.querySelectorAll(
        [
          '#box-specification tr',
          '#box-specifications tr',
          '.product-specs tr',
          '.specs-table tr',
          '.product-attribute tr',
          '.product-attributes tr',
          '.table-specs tr',
          '.thong-so-ky-thuat tr',
          'table tr',
        ].join(',')
      )) {
        if (row.closest('.related-products, .upsell, footer, header')) continue;
        const cells = [...row.querySelectorAll('th, td')].map(ownText).filter(Boolean);
        if (cells.length >= 2) {
          const key = cells[0].replace(/:$/, '').trim();
          const value = cells.slice(1).join(' ').replace(/\s+/g, ' ').trim();
          if (key && value && key.length <= 80 && value.length <= 500) specs[key] = value;
        }
      }

      for (const item of document.querySelectorAll('dl, .specification, .product-info')) {
        const labels = [...item.querySelectorAll('dt')];
        for (const label of labels) {
          const valueNode = label.nextElementSibling;
          const key = ownText(label).replace(/:$/, '').trim();
          const value = ownText(valueNode);
          if (key && value && key.length <= 80 && value.length <= 500) specs[key] = value;
        }
      }

      const sku = normalizeSku(skuCandidates, specs, name) || earlySku;
      const imageUrls = extractProductImages(document, sku, maxImages);
      const documents = extractDocuments(document);

      const variants = [...document.querySelectorAll(
        [
          'a.variant-item[href]',
          '.variant-item a[href]',
          '.variant a[href]',
          '[class*="variant"] a[href]',
          '.product-variations a[href]',
          '.product-options a[href]',
          '.choose-product a[href]',
          '.swatch a[href]',
        ].join(',')
      )]
        .map((a) => {
          const url = abs(a.getAttribute('href'));
          const label = ownText(a);
          return {
            label,
            clean_label: cleanVariantLabel(label),
            url,
            active: Boolean(a.classList.contains('active') || a.getAttribute('aria-selected') === 'true' || url === productUrl),
          };
        })
        .filter((item) => item.url && item.url.endsWith('.html'))
        .filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index);

      const packageIncludes = extractPackageIncludes(document, sku, name);

      return {
        source_url: productUrl,
        name,
        sku_raw: skuCandidates,
        sku,
        price_block_text: priceBlockText,
        status_text: statusText,
        inactive,
        breadcrumb,
        description_raw_html: descriptionRawHtml,
        description_clean_html: cleanResult.html,
        description_clean_issues: cleanResult.issues,
        specs,
        images: imageUrls,
        documents,
        package_includes: packageIncludes,
        variants,
      };

      function isValidProductImage(url) {
        if (!url || !/^https?:\/\//i.test(url)) return false;
        const lower = url.toLowerCase();
        if (/youtube|youtu\.be|video|thumbnail|thumb-video|placeholder|loading|spinner|logo|banner|brand|no-image/.test(lower)) return false;
        if (lower.includes('/storage/products/') || lower.includes('/storage/product/')) return true;
        if (lower.includes('/public/upload/images/')) return true;
        return lower.includes('hita.com.vn') && lower.includes('/storage/');
      }

      function extractProductImages(doc, sku, limit) {
        const gallerySelectors = [
          '.main-product-slider',
          '.product-slider',
          '.product-image-slider',
          '.product-images-slider',
          '.product-gallery-slider',
          '.slider-for',
          '.slider-nav',
          '.slick-slider',
          '.swiper-wrapper',
          '.owl-carousel',
          '.product-gallery',
          '.product-images',
          '.product-image',
          '.product-detail-left',
          '.product-column-left',
        ];
        const roots = gallerySelectors
          .map((selector) => doc.querySelector(selector))
          .filter(Boolean)
          .filter((root, index, all) => all.indexOf(root) === index);
        const comboTokens = skuParts(sku);
        const galleryUrls = roots
          .flatMap((root) => extractImageUrlsFromRoot(root))
          .filter(({ node }) => !isBlockedMediaSection(node))
          .map(({ url }) => url.trim())
          .filter(isValidProductImage);

        const fallbackUrls = roots.length
          ? []
          : [...doc.querySelectorAll('img')]
            .filter((img) => !isBlockedMediaSection(img))
            .map((img) => imageUrlFromNode(img))
            .filter((url) => isLikelyProductImageForSku(url, comboTokens))
            .filter(isValidProductImage);

        return [...galleryUrls, ...fallbackUrls]
          .map((url) => url.trim())
          .filter((url, index, all) => all.indexOf(url) === index)
          .slice(0, limit);
      }

      function extractImageUrlsFromRoot(root) {
        const urls = [];
        for (const img of root.querySelectorAll('img')) {
          urls.push(...imageUrlsFromNode(img).map((url) => ({ node: img, url })));
        }
        for (const source of root.querySelectorAll('source[srcset]')) {
          urls.push(...urlsFromSrcset(source.getAttribute('srcset')).map((url) => ({ node: source, url: abs(url) })));
        }
        for (const link of root.querySelectorAll('a[href]')) {
          const href = abs(link.getAttribute('href'));
          if (/\.(?:avif|webp|jpe?g|png)(?:$|\?)/i.test(href)) urls.push({ node: link, url: href });
        }
        return urls;
      }

      function imageUrlsFromNode(img) {
        const urls = [
          img.getAttribute('data-src'),
          img.getAttribute('data-lazy'),
          img.getAttribute('data-original'),
          img.getAttribute('data-zoom-image'),
          img.getAttribute('src'),
        ]
          .filter(Boolean)
          .map(abs);

        urls.push(...urlsFromSrcset(img.getAttribute('srcset')).map(abs));
        return urls.filter(Boolean);
      }

      function imageUrlFromNode(img) {
        return imageUrlsFromNode(img)[0] || '';
      }

      function urlsFromSrcset(srcset) {
        return String(srcset || '')
          .split(',')
          .map((item) => item.trim().split(/\s+/)[0])
          .filter(Boolean);
      }

      function isBlockedMediaSection(node) {
        return Boolean(node.closest([
          '.related-products',
          '.product-related',
          '.product-box-common',
          '.same-product',
          '.similar-product',
          '.viewed-products',
          '.upsell',
          '.section-buy-more',
          '.promotion',
          '.home-promotion-week',
          '.choose-product',
          '.product-variants',
          '.variant-products',
          '[class*="related"]',
          '[class*="viewed"]',
          '[class*="upsell"]',
          'footer',
          'header',
        ].join(',')));
      }

      function isLikelyProductImageForSku(url, comboTokens) {
        if (!comboTokens.length) return true;
        const lower = url.toLowerCase();
        return comboTokens.some((token) => lower.includes(token.toLowerCase().replace(/[^a-z0-9]/g, '')));
      }

      function skuParts(sku) {
        return String(sku || '')
          .split('+')
          .map((part) => part.trim())
          .filter((part) => part.length >= 3);
      }

      function normalizeSku(candidates, specMap, productName) {
        const joined = [...candidates, specMap['Mã sản phẩm'], specMap['Model'], specMap['SKU'], specMap['Mã']].filter(Boolean).join('\n');
        const direct = joined
          .replace(/(?:mã sản phẩm|mã sp|sku|model|code|mã)\s*[:：]?\s*/gi, '\n')
          .split(/\n|;/)
          .map((item) => item.trim())
          .find(isUsableSkuToken);
        if (direct) return direct.replace(/\s+/g, '').trim();

        const nameMatches = productName?.match(/\b[A-Z0-9]{2,}[A-Z0-9#\-_/+().]*\b/gi) || [];
        const fromName = nameMatches.find(isUsableSkuToken);
        return fromName ? fromName.replace(/\s+/g, '').trim() : null;
      }

      function isUsableSkuToken(item) {
        if (!item) return false;
        const normalized = item.replace(/\s+/g, '').trim();
        if (normalized.length < 3) return false;
        if (!/\d/.test(normalized)) return false;
        if (!/^[A-Z0-9][A-Z0-9#\-_/+().]{2,}$/i.test(normalized)) return false;
        return !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(normalized);
      }

      function cleanVariantLabel(value) {
        return (value || '')
          .replace(/\d{1,3}(?:\.\d{3})+\s*đ?/gi, '')
          .replace(/giảm thêm[^|,\n]+/gi, '')
          .replace(/giá[^|,\n]+/gi, '')
          .replace(/\s+/g, ' ')
          .replace(/^[|:,-]+|[|:,-]+$/g, '')
          .trim();
      }

      function cleanDescription(root, sku) {
        const issues = [];
        if (!root) return { html: '', issues: ['description_missing'] };
        const clone = root.cloneNode(true);
        materializeLazyImages(clone, issues);

        for (const node of clone.querySelectorAll('script, style, iframe, video, source, noscript')) {
          issues.push(`removed_${node.tagName.toLowerCase()}`);
          node.remove();
        }

        for (const node of clone.querySelectorAll('.description-show-more, .read-more, .show-more, .preview-intro-video, .youtube, [class*="youtube"], [class*="video"]')) {
          issues.push(`removed_non_content_block:${node.className || node.tagName.toLowerCase()}`);
          node.remove();
        }

        for (const img of [...clone.querySelectorAll('img')]) {
          const src = abs(img.getAttribute('src') || img.getAttribute('data-src') || '');
          const alt = `${img.getAttribute('alt') || ''} ${img.className || ''}`.toLowerCase();
          const lower = src.toLowerCase();
          if (/youtube|youtu\.be|video|thumbnail|placeholder|loading|spinner|logo|banner|brand|no-image|icon-pdf|pdf\.png|attachment/.test(`${lower} ${alt}`)) {
            issues.push(`removed_non_content_image:${src}`);
            img.remove();
            continue;
          }
          if (src) {
            img.setAttribute('src', src);
            img.removeAttribute('data-src');
            img.removeAttribute('data-lazy');
            img.removeAttribute('data-original');
            img.removeAttribute('data-zoom-image');
            if (/\blazy\b/i.test(img.className || '')) img.classList.remove('lazy');
          }
          if (src && /hita\.com\.vn/i.test(src) && !/cdn\.hita\.com\.vn/i.test(src)) {
            issues.push(`needs_cdn_rewrite:${src}`);
          }
        }

        for (const link of [...clone.querySelectorAll('a[href]')]) {
          const href = abs(link.getAttribute('href'));
          if (/\.pdf($|\?)/i.test(href) || /\/download/i.test(href)) {
            issues.push(`removed_document_link_from_description:${href}`);
            link.remove();
            continue;
          }
          if (/hita\.com\.vn/i.test(href) && !/\.pdf($|\?)/i.test(href)) {
            issues.push(`unwrapped_hita_link:${href}`);
            link.replaceWith(...link.childNodes);
          }
        }

        appendMissingTechnicalDrawing(clone, issues, sku);

        for (const node of [...clone.querySelectorAll('p, div, li, span')]) {
          const value = ownText(node);
          if (!value || value.length > 220) continue;
          if (/(hotline|showroom|địa chỉ|dia chi|zalo|hita|mua hàng|liên hệ|lien he|gọi ngay|goi ngay|\b0\d{8,10}\b)/i.test(value)) {
            issues.push(`removed_hita_contact_or_cta:${value.slice(0, 80)}`);
            node.remove();
          }
        }

        return { html: clone.innerHTML.trim(), issues };
      }

      function appendMissingTechnicalDrawing(clone, issues, sku) {
        const textValue = ownText(clone);
        if (!/bản vẽ kỹ thuật|ban ve ky thuat/i.test(textValue)) return;
        const existingImageUrls = [...clone.querySelectorAll('img')]
          .map((img) => abs(img.getAttribute('src') || img.getAttribute('data-src') || ''))
          .join(' ');
        if (/bvkt|ban-ve|bản-vẽ/i.test(existingImageUrls)) return;

        const candidate = findTechnicalDrawingImage(document, sku);
        if (!candidate) return;

        const figure = document.createElement('figure');
        const img = document.createElement('img');
        img.setAttribute('src', candidate.url);
        img.setAttribute('alt', candidate.alt || 'Bản vẽ kỹ thuật');
        img.setAttribute('loading', 'lazy');
        img.setAttribute('width', '740');
        img.setAttribute('height', '740');
        figure.appendChild(img);
        clone.appendChild(figure);
        issues.push(`appended_technical_drawing:${candidate.url}`);
      }

      function findTechnicalDrawingImage(doc, sku) {
        const comboTokens = skuParts(sku);
        const image = [...doc.querySelectorAll('.main-product-slider img, .product-slider img, .product-detail-left img, .product-column-left img, .product-gallery img, .product-images img')]
          .filter((img) => !isBlockedMediaSection(img))
          .map((img) => {
            const url = abs(img.getAttribute('data-src') || img.getAttribute('data-lazy') || img.getAttribute('data-original') || img.getAttribute('src') || '').trim();
            const alt = ownText(img) || img.getAttribute('alt') || '';
            return { url, alt };
          })
          .find((item) => item.url && isValidProductImage(item.url) && /bvkt|ban-ve|bản-vẽ|ban-ve-ky-thuat/i.test(`${item.url} ${item.alt}`) && isLikelyProductImageForSku(item.url, comboTokens));
        return image || null;
      }

      function findDescriptionRoot() {
        const selectors = [
          '#description-content .description-collapse',
          '#description-content',
          '.description-collapse',
          '#box-description',
          '#description',
          '.product-description',
          '.product-content',
          '.tab-content',
        ];

        const candidates = selectors
          .map((selector) => document.querySelector(selector))
          .filter(Boolean)
          .filter((node) => ownText(node).length > 120 || node.querySelector('img, h2, h3, table, ul, ol'));

        if (candidates.length === 0) return null;
        return candidates.sort((a, b) => ownText(b).length - ownText(a).length)[0];
      }

      function findDescriptionCleanRoot(root) {
        if (!root) return null;
        const selectors = [
          '#description-content .description-collapse',
          '.description-content .description-collapse',
          '.description-collapse.editor-content',
          '.description-collapse',
          '#description-content',
          '.description-content',
        ];

        for (const selector of selectors) {
          const candidate = root.matches?.(selector) ? root : root.querySelector(selector);
          if (candidate && (ownText(candidate).length > 120 || candidate.querySelector('img, h2, h3, table, ul, ol'))) {
            return candidate;
          }
        }

        return root;
      }

      function extractRawDescriptionHtml(root) {
        if (!root) return '';
        const clone = root.cloneNode(true);
        materializeLazyImages(clone, []);
        for (const node of clone.querySelectorAll('script, style, noscript')) node.remove();
        return clone.innerHTML.trim();
      }

      function materializeLazyImages(root, issues) {
        for (const img of [...root.querySelectorAll('img')]) {
          const lazySrc = abs(
            img.getAttribute('data-src') ||
            img.getAttribute('data-lazy') ||
            img.getAttribute('data-original') ||
            img.getAttribute('data-zoom-image') ||
            ''
          );
          const currentSrc = abs(img.getAttribute('src') || '');
          const currentLooksPlaceholder = !currentSrc || /placeholder|loading|spinner|original\.jpg|blank|no-image/i.test(currentSrc);
          if (lazySrc && (currentLooksPlaceholder || lazySrc !== currentSrc)) {
            img.setAttribute('src', lazySrc);
            issues?.push(`rewrote_lazy_image:${currentSrc || '(empty)'}->${lazySrc}`);
          }
        }
      }

      function extractPackageIncludes(doc, sku, productName) {
        const packageRoot =
          doc.querySelector('#box-package-include') ||
          doc.querySelector('.package-include');
        if (packageRoot) {
          const scopedValues = [...packageRoot.querySelectorAll('.panel-body p, .panel-body li, .card-body p, .card-body li, td')]
            .map(ownText)
            .filter(isPackageIncludeValue);
          if (scopedValues.length > 0) return [...new Set(scopedValues)].slice(0, 20);
        }

        return deriveComboPackageIncludes(sku, productName);
      }

      function deriveComboPackageIncludes(sku, productName) {
        const parts = skuParts(sku);
        if (parts.length < 2) return [];
        return parts.map((part, index) => labelComboComponent(part, index, productName));
      }

      function labelComboComponent(part, index, productName) {
        const nameValue = productName || '';
        if (index === 0) {
          if (/tủ chậu|tu chau|cabinet/i.test(nameValue)) return `Lavabo ${part}`;
          if (/bồn cầu|bon cau/i.test(nameValue)) return `Bồn cầu ${part}`;
          if (/bồn tắm|bon tam/i.test(nameValue)) return `Bồn tắm ${part}`;
          if (/sen/i.test(nameValue)) return `Sen tắm ${part}`;
          if (/vòi|voi/i.test(nameValue)) return `Vòi ${part}`;
          return `Sản phẩm ${part}`;
        }
        if (/^EH/i.test(part)) return `Tủ ${part}`;
        if (/^TAF|TCF|CW|WASHLET/i.test(part)) {
          if (/rửa cơ|rua co/i.test(nameValue)) return `Nắp rửa cơ ${part}`;
          if (/điện tử|dien tu|washlet/i.test(nameValue)) return `Nắp điện tử ${part}`;
          return `Nắp ${part}`;
        }
        if (/^M\d/i.test(part)) return `Nắp ${part}`;
        return `Phụ kiện ${part}`;
      }

      function extractDocuments(doc) {
        const attachmentRoot =
          doc.querySelector('#box-attachments') ||
          doc.querySelector('.attachments');
        const links = attachmentRoot
          ? [...attachmentRoot.querySelectorAll('a[href]')]
          : [...doc.querySelectorAll('a[href]')].filter((link) => {
              const href = absWithQuery(link.getAttribute('href'));
              const label = ownText(link);
              return isDocumentUrl(href) || /(bản vẽ|catalog|catalogue|cad|file|tài liệu|hướng dẫn|manual)/i.test(label);
            });

        return links
          .map((a) => {
            const url = absWithQuery(a.getAttribute('href'));
            const name = ownText(a) || a.getAttribute('title') || inferDocumentName(url);
            return {
              name,
              url,
              type: inferDocumentType(url, name),
            };
          })
          .filter((item) => item.url && isDocumentUrl(item.url))
          .filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index)
          .slice(0, 12);
      }

      function isPackageIncludeValue(value) {
        if (!value || value.length > 120) return false;
        if (/(nguyên hộp|bao gồm|bộ gồm|gồm có|phụ kiện đi kèm|sản phẩm bao gồm|hotline|hita|showroom|địa chỉ|zalo)/i.test(value)) return false;
        if (/^(danh mục|mã sản phẩm|vị trí lắp|chất liệu(?:\s+[^:]+)?|màu sắc(?:\s+[^:]+)?|size(?:\s+[^:]+)?|kích thước(?:\s+[^:]+)?|dung lượng(?:\s+[^:]+)?|công nghệ|nguồn điện|công suất|thiết kế|bản lề|chậu sứ|áp lực nước|tâm thoát|kiểu thoát|kiểu xả|lượng nước xả|hệ thống xả|điện áp|nguồn nước)\s*:/i.test(value)) return false;
        if (/(rimless|aqua-?jet|sấy khô|bệ ngồi|kháng khuẩn|khử mùi|massage|bọt khí|phát sáng|bảo vệ an toàn|dễ vệ sinh|hạn chế bám bẩn|thiết kế|sang trọng|không gian lưu trữ|bền bỉ|phong cách|thân thiện)/i.test(value)) return false;
        return true;
      }

      function isDocumentUrl(url) {
        if (!url) return false;
        if (isPromotionalAssetUrl(url)) return false;
        return /\.(pdf|dwg|dxf|jpg|jpeg|png|webp)($|\?)/i.test(url) || /\/download(?:\?|$)/i.test(url);
      }

      function isPromotionalAssetUrl(url) {
        return /\/storage\/banner\/|\/banner\/|\/widget\/|icon-|logo|brand|placeholder|loading|spinner/i.test(url);
      }

      function inferDocumentName(url) {
        if (/\/download/i.test(url)) return 'Tài liệu tải xuống';
        const filename = decodeURIComponent(url.split('/').pop() || '').split('?')[0];
        return filename || 'Tài liệu sản phẩm';
      }

      function inferDocumentType(url, name) {
        const value = `${url} ${name}`.toLowerCase();
        if (/\.dwg|\.dxf|cad/.test(value)) return 'CAD';
        if (/\.(jpg|jpeg|png|webp)|bản vẽ|ban-ve/.test(value)) return 'IMAGE';
        if (/\.pdf/.test(value)) return 'PDF';
        return 'DOCUMENT';
      }
    }, { baseUrl: BASE_URL, maxImages: MAX_IMAGES });

    const price = parsePriceBlock(raw.price_block_text);
    if (raw.inactive) {
      price.price = null;
      price.original_price = null;
      price.online_discount_amount = null;
      price.price_display = 'Ngừng kinh doanh';
      price.price_state = 'discontinued';
      price.inactive = true;
    }
    const taxonomy = inferTaxonomy(raw);
    const slug = deriveSlug(raw.source_url, raw.name, raw.sku);
    const hitaProductId = raw.source_url.match(/-(\d+)\.html$/)?.[1] || null;
    const skippedReason = getHardSkipReason({ ...raw, slug, price });

    return {
      ...raw,
      source_seed: candidate.source,
      sample_reason: candidate.reason || candidate.source,
      slug,
      hita_product_id: hitaProductId ? Number.parseInt(hitaProductId, 10) : null,
      price,
      taxonomy,
      crawl_ms: Date.now() - startedAt,
      skippedReason,
    };
  } catch (error) {
    return {
      source_url: candidate.url,
      source_seed: candidate.source,
      sample_reason: candidate.reason || candidate.source,
      skippedReason: 'crawl_error',
      error: error.message,
      crawl_ms: Date.now() - startedAt,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

function getHardSkipReason(product) {
  if (!product.sku) return 'sku_null';
  if (String(product.sku).trim().length < 3) return 'sku_invalid';
  if (!product.name) return 'name_null';
  if (!product.slug) return 'slug_null';
  if (!product.images?.length) return 'image_null';
  return null;
}

function parsePriceBlock(text) {
  const raw = text || '';
  const lines = raw.split(/\n| {2,}/).map((line) => line.trim()).filter(Boolean);
  const inactive = /ngưng hoạt động|ngung hoat dong|ngừng kinh doanh|ngung kinh doanh/i.test(raw);
  const originalMatch = raw.match(/(?:giá gốc|giá niêm yết|gia goc|niem yet)\s*[:：]?\s*([\d.]+\s*đ?)/i);
  const discountMatch = raw.match(/(?:giảm thêm|giam them)\s*[:：]?\s*([\d.]+\s*đ?)/i);
  const leadingPriceMatch = raw.trim().match(/^([\d.]+\s*đ?)/i);
  const priceLine = leadingPriceMatch?.[1] || lines.find((line) => /\d[\d.]+\s*đ/i.test(line) && !/(giá gốc|giá niêm yết|giảm thêm|gia goc|niem yet|giam them|lắp đặt|tháo dỡ)/i.test(line) && !/%/.test(line));
  const contact = /(liên hệ|lien he|báo giá|bao gia)/i.test(raw);
  const price = parseVND(priceLine);
  const priceState = inactive
    ? 'discontinued'
    : price
      ? 'priced'
      : 'no_price_contact';

  return {
    price,
    original_price: parseVND(originalMatch?.[1]),
    online_discount_amount: parseVND(discountMatch?.[1]),
    price_display: priceState === 'discontinued' ? 'Ngừng kinh doanh' : contact || priceState === 'no_price_contact' ? 'Liên hệ báo giá' : null,
    price_state: priceState,
    raw_text: raw,
    inactive,
  };
}

function inferTaxonomy(product) {
  const breadcrumbCandidates = [];
  for (const item of product.breadcrumb || []) {
    const pathname = new URL(item.href, BASE_URL).pathname;
    if (pathname === '/' || pathname === '') continue;
    const mapped = lookupCategory(item.href);
    if (mapped) breadcrumbCandidates.push({ ...mapped, source: item.href, text: item.text });
  }

  const breadcrumbResolved = [...breadcrumbCandidates]
    .reverse()
    .find((item) => item.category_id && (item.subcategory_id || item.category_id === 'thiet-bi-bep'));
  const roughSubcategory = roughSubcategoryFromUrl(product.source_url);
  const searchable = `${product.name || ''} ${product.sku || ''} ${Object.values(product.specs || {}).join(' ')}`;
  const rule = PRODUCT_TYPE_RULES.find((item) => {
    if (
      breadcrumbResolved?.category_id === 'thiet-bi-bep' &&
      !KITCHEN_SUBCATEGORY_IDS.includes(item.subcategory_id)
    ) {
      return false;
    }
    const expectedSubcategory = breadcrumbResolved?.subcategory_id || roughSubcategory;
    return (!expectedSubcategory || item.subcategory_id === expectedSubcategory) && item.regex.test(searchable);
  });

  let category_id = breadcrumbResolved?.category_id || 'thiet-bi-ve-sinh';
  let subcategory_id = breadcrumbResolved?.subcategory_id || roughSubcategory || null;
  let product_type = breadcrumbResolved?.product_type || rule?.product_type || null;
  let product_sub_type = null;
  const reasons = [];

  if (breadcrumbResolved) {
    reasons.push(`breadcrumb:${breadcrumbResolved.text || breadcrumbResolved.source}`);
  }
  if (roughSubcategory && roughSubcategory !== subcategory_id) {
    reasons.push(`url_slug_rough:${roughSubcategory}`);
  }
  if (rule) {
    reasons.push(`name_sku_spec_rule:${rule.regex}`);
    subcategory_id = subcategory_id || rule.subcategory_id;
  }

  if (category_id === 'thiet-bi-bep' && product_type === 'voi-rua-chen') {
    subcategory_id = 'voi-rua-chen';
  }
  if (
    category_id === 'thiet-bi-bep' &&
    subcategory_id &&
    !KITCHEN_SUBCATEGORY_IDS.includes(subcategory_id)
  ) {
    subcategory_id = null;
  }

  if (/nhiệt độ/i.test(searchable) && subcategory_id === 'sen-tam') product_sub_type = 'sen-nhiet-do';
  if (/âm tường/i.test(searchable) && subcategory_id === 'sen-tam') product_sub_type = 'sen-am-tuong';
  if (subcategory_id === 'sen-tam' && product_type === 'phu-kien-sen-voi') {
    if (/(bát sen|đầu phun|dau phun|đầu sen|dau sen)/i.test(searchable)) product_sub_type = 'bat-sen';
    else if (/tay sen/i.test(searchable)) product_sub_type = 'tay-sen';
    else if (/thanh trượt/i.test(searchable)) product_sub_type = 'thanh-truot-sen';
    else if (/dây sen/i.test(searchable)) product_sub_type = 'day-sen';
    else if (/(gác sen|cút nối)/i.test(searchable)) product_sub_type = 'gac-sen-cut-noi';
    else if (/van điều chỉnh/i.test(searchable)) product_sub_type = 'van-dieu-chinh';
    else product_sub_type = 'linh-kien-sen';
  }
  if (/cảm ứng/i.test(searchable) && subcategory_id === 'voi-chau') product_sub_type = 'voi-cam-ung';
  if (subcategory_id === 'bon-cau' && /(nắp êm|nắp đóng êm|nap em|nap dong em)/i.test(searchable)) product_sub_type = 'nap-dong-em';
  if (subcategory_id === 'bon-cau' && /(nắp rửa cơ|nap rua co)/i.test(searchable)) product_sub_type = 'nap-rua-co';
  if (subcategory_id === 'bon-cau' && /(nắp điện tử|nap dien tu)/i.test(searchable)) product_sub_type = 'nap-dien-tu';
  if (subcategory_id === 'bon-cau' && product_type === 'phu-kien-bon-cau') {
    if (/nắp két/i.test(searchable)) product_sub_type = 'nap-ket-nuoc';
    else if (/thân két/i.test(searchable)) product_sub_type = 'than-ket-nuoc';
    else if (/két nước|bộ két/i.test(searchable)) product_sub_type = 'ket-nuoc';
    else if (/bộ xả/i.test(searchable)) product_sub_type = 'bo-xa-bon-cau';
    else if (/van xả/i.test(searchable)) product_sub_type = 'van-xa-bon-cau';
    else if (/thân sứ|thân cầu/i.test(searchable)) product_sub_type = 'than-su-cau';
    else if (/đế cầu|con thỏ/i.test(searchable)) product_sub_type = 'de-cau-con-tho';
    else product_sub_type = 'linh-kien-bon-cau';
  }

  const confidence = (() => {
    if (!subcategory_id) return 'quarantine';
    if (breadcrumbResolved && rule) return 'high';
    if (breadcrumbResolved || rule) return 'medium';
    return 'low';
  })();

  return {
    category_id,
    subcategory_id,
    product_type,
    product_sub_type,
    confidence,
    sources: {
      candidate_seed: product.source_seed,
      source_listing_url: breadcrumbResolved?.source || null,
      pdp_breadcrumb: product.breadcrumb || [],
      rough_url_subcategory: roughSubcategory,
      rule_matched: rule ? String(rule.regex) : null,
    },
    reasons,
    quarantine_reason: confidence === 'quarantine' ? 'taxonomy_unmapped' : null,
  };
}

function deriveSlug(url, name, sku) {
  const fromUrl = url ? new URL(url).pathname.replace(/^\//, '').replace(/\.html$/, '') : '';
  if (fromUrl) return fromUrl;
  if (!name || !sku) return null;
  return `${slugify(name)}-${slugify(sku)}`;
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeProduct(raw) {
  const taxonomy = raw.taxonomy || {};
  const filterSpecs = deriveFilterSpecs(raw);
  const specs = { ...(raw.specs || {}) };
  if (raw.documents?.length) specs.documents = raw.documents;
  if (raw.package_includes?.length) specs['Phụ kiện đi kèm'] = raw.package_includes;

  return {
    sku: raw.sku,
    name: raw.name,
    slug: raw.slug,
    source_url: raw.source_url,
    hita_product_id: raw.hita_product_id,
    brand_slug: BRAND_SLUG,
    category_id: taxonomy.category_id,
    subcategory_id: taxonomy.subcategory_id,
    product_type: taxonomy.product_type,
    product_sub_type: taxonomy.product_sub_type,
    price: raw.price?.price ?? null,
    original_price: raw.price?.original_price ?? null,
    online_discount_amount: raw.price?.online_discount_amount ?? null,
    price_display: raw.price?.price_display ?? null,
    price_state: raw.price?.price_state ?? (raw.skippedReason === 'crawl_error' ? 'crawl_failed' : null),
    stock_status: raw.price?.price_state === 'discontinued' || raw.inactive ? 'discontinued' : 'in_stock',
    image_main_url: raw.images?.[0] || null,
    product_images: (raw.images || []).map((url, index) => ({
      url,
      sort_order: index + 1,
      alt: raw.name,
    })),
    description: raw.description_clean_html || null,
    description_raw_html: raw.description_raw_html || null,
    description_clean_issues: raw.description_clean_issues || [],
    specs,
    filter_specs: filterSpecs,
    variant_group: null,
    variant_type: null,
    variant_label: null,
    is_master: true,
    is_combo: Boolean(raw.package_includes?.length && /(bộ|combo|bao gồm|gồm)/i.test(raw.name || '')),
    relationship_candidates: deriveRelationshipCandidates(raw),
    qa: buildProductQa(raw, filterSpecs),
  };
}

function deriveFilterSpecs(raw) {
  const taxonomy = raw.taxonomy || {};
  const specs = raw.specs || {};
  const searchable = `${raw.name || ''} ${Object.values(specs).join(' ')}`;
  const result = {};

  if (taxonomy.product_type) result.product_type = taxonomy.product_type;
  if (taxonomy.product_sub_type) result.product_sub_type = taxonomy.product_sub_type;

  const directMappings = [
    { key: 'Màu sắc', aliases: [/màu/i, /color/i] },
    { key: 'Chất liệu', aliases: [/chất liệu/i, /vật liệu/i, /material/i] },
    { key: 'Kích thước', aliases: [/kích thước/i, /size/i] },
    { key: 'Dung Tích', aliases: [/dung tích/i] },
    { key: 'Chiều Dài Bồn Tắm', aliases: [/chiều dài bồn tắm/i] },
    { key: 'Tính năng bồn tắm', aliases: [/tính năng bồn tắm/i] },
    { key: 'Tâm xả', aliases: [/tâm xả/i, /rough/i] },
    { key: 'Kiểu xả', aliases: [/kiểu xả/i, /hệ thống xả/i, /xả/i] },
    { key: 'Loại nắp', aliases: [/loại nắp/i, /nắp/i] },
    { key: 'Hình dáng', aliases: [/hình dáng/i, /kiểu dáng/i] },
    { key: 'Kiểu lắp vòi', aliases: [/kiểu lắp vòi/i, /lỗ lắp vòi/i, /lỗ vòi/i] },
    { key: 'Vị trí lắp vòi', aliases: [/vị trí lắp vòi/i, /vị trí lắp/i] },
    { key: 'Độ cao vòi', aliases: [/độ cao vòi/i] },
    { key: 'Lớp mạ (màu)', aliases: [/lớp mạ/i] },
    { key: 'Kích thước bát sen', aliases: [/kích thước bát sen/i] },
  ];

  for (const [sourceKey, value] of Object.entries(specs)) {
    for (const mapping of directMappings) {
      if (mapping.aliases.some((regex) => regex.test(sourceKey)) && value) {
        result[mapping.key] = value;
      }
    }
  }

  if (taxonomy.subcategory_id === 'bon-cau') {
    result['Kiểu bồn cầu'] = inferLabel(searchable, [
      ['Bồn cầu treo tường', /treo tường/i],
      ['Bồn cầu 1 khối', /(1 khối|một khối)/i],
      ['Bồn cầu 2 khối', /(2 khối|hai khối)/i],
      ['Bồn cầu thông minh', /(bồn cầu thông minh|smart toilet)/i],
    ]) || result['Kiểu bồn cầu'];
    result['Loại nắp'] = inferLabel(searchable, [
      ['Nắp điện tử', /(nắp điện tử|nap dien tu|washlet)/i],
      ['Nắp rửa cơ', /(nắp rửa cơ|nap rua co)/i],
      ['Nắp đóng êm', /(nắp đóng êm|nắp êm|nap dong em|nap em|mu234|m221)/i],
      ['Nắp thường', /nắp thường/i],
    ]) || result['Loại nắp'];
  }

  if (taxonomy.subcategory_id === 'lavabo') {
    result['Kiểu lắp'] = inferLabel(searchable, [
      ['Âm bàn', /âm bàn/i],
      ['Bán âm', /bán âm/i],
      ['Dương vành', /dương vành/i],
      ['Đặt bàn', /(đặt bàn|dương bàn)/i],
      ['Treo tường', /treo tường/i],
    ]) || result['Kiểu lắp'];
  }

  if (taxonomy.subcategory_id === 'sen-tam') {
    result['Kiểu sen'] = inferLabel(searchable, [
      ['Sen cây', /sen cây/i],
      ['Sen âm tường', /âm tường/i],
      ['Tay sen', /tay sen/i],
      ['Bát sen', /(bát sen|đầu phun)/i],
      ['Củ sen', /củ sen/i],
    ]) || result['Kiểu sen'];
    result['Chế độ'] = inferLabel(searchable, [
      ['Nhiệt độ', /nhiệt độ/i],
      ['Nóng lạnh', /nóng lạnh/i],
      ['Lạnh', /nước lạnh/i],
    ]) || result['Chế độ'];
  }

  if (taxonomy.subcategory_id === 'voi-chau' || taxonomy.subcategory_id === 'voi-rua-chen') {
    result['Chế độ'] = inferLabel(searchable, [
      ['Nóng lạnh', /nóng lạnh/i],
      ['Lạnh', /nước lạnh/i],
      ['Nhiệt độ', /nhiệt độ/i],
    ]) || result['Chế độ'];
    result['Loại vòi'] = inferLabel(searchable, [
      ['Cảm ứng', /cảm ứng/i],
      ['Bán tự động', /bán tự động/i],
      ['Thông thường', /(vòi chậu|vòi lavabo|vòi nước|vòi bếp)/i],
    ]) || result['Loại vòi'];
    result['Vị trí lắp vòi'] = inferLabel(searchable, [
      ['Gắn tường', /gắn tường/i],
      ['Trên chậu / bàn', /(gắn chậu|lavabo|trên chậu|trên bàn)/i],
      ['Trên bồn', /trên bồn/i],
    ]) || result['Vị trí lắp vòi'];
    result['Độ cao vòi'] = inferLabel(searchable, [
      ['Vòi cổ cao', /(cổ cao|voi co cao)/i],
      ['Vòi cổ trung', /(cổ trung|voi co trung)/i],
      ['Vòi cổ thấp', /(cổ thấp|voi co thap)/i],
    ]) || result['Độ cao vòi'];
    result['Kiểu lắp vòi'] = inferLabel(searchable, [
      ['1 lỗ', /(1 lỗ|1 lo)/i],
      ['2 lỗ', /(2 lỗ|2 lo)/i],
      ['3 lỗ', /(3 lỗ|3 lo)/i],
      ['Dây rút', /dây rút/i],
    ]) || result['Kiểu lắp vòi'];
  }

  if (taxonomy.subcategory_id === 'phu-kien-phong-tam' || taxonomy.subcategory_id === 'phu-kien-bon-cau') {
    result['Nhóm phụ kiện'] = inferLabel(searchable, [
      ['Phễu thoát sàn', /phễu thoát/i],
      ['Vòi xịt vệ sinh', /vòi xịt/i],
      ['Két nước', /két nước/i],
      ['Bộ xả', /bộ xả/i],
    ]) || result['Nhóm phụ kiện'];
  }

  if (taxonomy.subcategory_id === 'bon-tieu' && taxonomy.product_type !== 'bon-tieu-nam') {
    return Object.fromEntries(
      Object.entries(result)
        .filter(([key]) => key === 'product_type' || key === 'product_sub_type')
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
    );
  }

  const allowedKeys = FILTER_KEYS_BY_SUBCATEGORY[taxonomy.subcategory_id] || null;
  return Object.fromEntries(
    Object.entries(result)
      .filter(([key]) => !allowedKeys || allowedKeys.includes(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

function inferLabel(value, rules) {
  const matched = rules.find(([, regex]) => regex.test(value));
  return matched?.[0] || null;
}

function deriveRelationshipCandidates(raw) {
  const labels = normalizeRelationshipPackageLabels(raw);
  const candidates = [];
  for (const item of labels) {
    const sku = childSkuCandidateFromPackageLabel(item);
    candidates.push({
      relationship_type: 'component',
      component_type: 'included_item',
      child_sku_candidate: sku,
      label: item,
      resolution_status: sku ? 'needs_resolve_after_import' : 'needs_manual_review',
    });
  }
  return candidates;
}

function normalizeRelationshipPackageLabels(raw) {
  const labels = (raw.package_includes || [])
    .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(isRelationshipPackageLabel);
  if (labels.length) return [...new Set(labels)];
  return deriveComboPackageLabelsFromSku(raw.sku, raw.name);
}

function isRelationshipPackageLabel(value) {
  if (!value || value.length > 160) return false;
  if (/^(nguyên hộp|bao gồm|bộ gồm|gồm có|phụ kiện đi kèm|sản phẩm bao gồm)\s*:?\s*$/i.test(value)) return false;
  if (/^(danh mục|mã sản phẩm|vị trí lắp|chất liệu(?:\s+[^:]+)?|màu sắc(?:\s+[^:]+)?|size(?:\s+[^:]+)?|kích thước(?:\s+[^:]+)?|dung lượng(?:\s+[^:]+)?|công nghệ|nguồn điện|công suất|thiết kế|bản lề|chậu sứ|áp lực nước|tâm thoát|kiểu thoát|kiểu xả|lượng nước xả|hệ thống xả|điện áp|nguồn nước)\s*:/i.test(value)) return false;
  if (/(rimless|aqua-?jet|sấy khô|bệ ngồi|kháng khuẩn|khử mùi|massage|bọt khí|phát sáng|bảo vệ an toàn|dễ vệ sinh|hạn chế bám bẩn|sang trọng|không gian lưu trữ|bền bỉ|phong cách|thân thiện)/i.test(value)) return false;
  return true;
}

function childSkuCandidateFromPackageLabel(label) {
  const matches = String(label || '').match(/\b[A-Z0-9][A-Z0-9#./()_-]{2,}\b/gi) || [];
  const sku = matches
    .map((item) => item.replace(/\s+/g, '').trim())
    .find((item) => /\d/.test(item) && /^[A-Z0-9][A-Z0-9#./()_-]{2,}$/i.test(item));
  return sku || null;
}

function deriveComboPackageLabelsFromSku(sku, productName) {
  const parts = String(sku || '').split('+').map((part) => part.trim()).filter((part) => part.length >= 3);
  if (parts.length < 2) return [];
  return parts.map((part, index) => labelComboSkuPart(part, index, productName));
}

function labelComboSkuPart(part, index, productName) {
  const nameValue = productName || '';
  if (index === 0) {
    if (/tủ chậu|tu chau|cabinet/i.test(nameValue)) return `Lavabo ${part}`;
    if (/bồn cầu|bon cau/i.test(nameValue)) return `Bồn cầu ${part}`;
    if (/bồn tắm|bon tam/i.test(nameValue)) return `Bồn tắm ${part}`;
    if (/sen/i.test(nameValue)) return `Sen tắm ${part}`;
    if (/vòi|voi/i.test(nameValue)) return `Vòi ${part}`;
    return `Sản phẩm ${part}`;
  }
  if (/^EH/i.test(part)) return `Tủ ${part}`;
  if (/^TAF|TCF|CW|WASHLET/i.test(part)) {
    if (/rửa cơ|rua co/i.test(nameValue)) return `Nắp rửa cơ ${part}`;
    if (/điện tử|dien tu|washlet/i.test(nameValue)) return `Nắp điện tử ${part}`;
    return `Nắp ${part}`;
  }
  if (/^M\d/i.test(part)) return `Nắp ${part}`;
  return `Phụ kiện ${part}`;
}

function buildProductQa(raw, filterSpecs) {
  const issues = [];
  if (!raw.sku) issues.push('missing_sku');
  if (!raw.name) issues.push('missing_name');
  if (!raw.slug) issues.push('missing_slug');
  if (!raw.images?.length) issues.push('missing_product_image');
  if (!raw.description_raw_html) issues.push('missing_description_raw_html');
  if (!raw.description_clean_html) issues.push('missing_description_clean_html');
  if (!raw.specs || Object.keys(raw.specs).length < 3) issues.push('low_specs_count');
  if (!raw.price?.price && !raw.price?.price_display) issues.push('missing_price_or_price_display');
  if (raw.taxonomy?.confidence === 'low') issues.push('low_taxonomy_confidence');
  if (raw.taxonomy?.confidence === 'quarantine') issues.push('taxonomy_quarantine');
  if (!Object.keys(filterSpecs).length) issues.push('missing_filter_specs');
  return issues;
}

function assignVariantGroups(normalizedProducts, rawProducts) {
  const byUrl = new Map(normalizedProducts.map((product) => [product.source_url, product]));
  const edges = new Map();

  for (const raw of rawProducts) {
    const validVariants = (raw.variants || [])
      .map((variant) => normalizeProductUrl(variant.url))
      .filter((url) => byUrl.has(url));

    if (validVariants.length > 0) {
      const source = raw.source_url;
      if (!edges.has(source)) edges.set(source, new Set());
      for (const url of validVariants) {
        edges.get(source).add(url);
        if (!edges.has(url)) edges.set(url, new Set());
        edges.get(url).add(source);
      }
    }
  }

  const visited = new Set();
  const groups = [];

  for (const url of byUrl.keys()) {
    if (visited.has(url) || !edges.has(url)) continue;
    const stack = [url];
    const component = [];
    visited.add(url);

    while (stack.length) {
      const current = stack.pop();
      if (byUrl.has(current)) component.push(byUrl.get(current));
      for (const next of edges.get(current) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    const uniqueProducts = [...new Map(component.map((product) => [product.source_url, product])).values()];
    if (uniqueProducts.length < 2) continue;

    const groupKey = deriveVariantGroupKey(uniqueProducts.map((product) => product.sku));
    const sorted = [...uniqueProducts].sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
    for (const product of sorted) {
      product.variant_group = groupKey;
      product.variant_type = inferVariantType(product, rawProducts);
      product.variant_label = deriveVariantLabel(product, rawProducts);
      product.is_master = product.source_url === sorted[0].source_url;
    }

    groups.push({
      variant_group: groupKey,
      variant_type: sorted[0].variant_type,
      master_sku: sorted[0].sku,
      products: sorted.map((product) => ({
        sku: product.sku,
        name: product.name,
        source_url: product.source_url,
        variant_label: product.variant_label,
        is_master: product.is_master,
      })),
      rule: 'connected_hita_variant_links + base_model_from_sku',
    });
  }

  const unresolvedCandidates = rawProducts
    .filter((raw) => raw.variants?.length)
    .map((raw) => ({
      sku: raw.sku,
      source_url: raw.source_url,
      crawled_group_assigned: Boolean(byUrl.get(raw.source_url)?.variant_group),
      variant_candidates: raw.variants.map((variant) => ({
        label: variant.clean_label,
        url: variant.url,
        crawled_in_sample: byUrl.has(normalizeProductUrl(variant.url)),
      })),
    }));

  return { groups, unresolvedCandidates };
}

function deriveVariantGroupKey(skus) {
  const bases = skus
    .map((sku) => String(sku || '').toUpperCase().trim())
    .filter(Boolean)
    .map((sku) => sku.replace(/#[A-Z0-9]+$/i, '').replace(/\/[A-Z]{1,4}\d?$/i, '').split('+')[0].trim());

  if (!bases.length) return null;
  let prefix = bases[0];
  for (const base of bases.slice(1)) {
    let index = 0;
    while (index < prefix.length && index < base.length && prefix[index] === base[index]) index += 1;
    prefix = prefix.slice(0, index);
  }
  prefix = prefix.replace(/[-_/.\s]+$/g, '');
  if (prefix.length >= 4) return prefix;
  return bases.sort((a, b) => a.length - b.length)[0].slice(0, 50);
}

function inferVariantType(product, rawProducts) {
  const raw = rawProducts.find((item) => item.source_url === product.source_url);
  const labels = [product.name, ...(raw?.variants || []).map((variant) => variant.clean_label)].join(' ');
  if (/(màu|trắng|đen|hồng|xám|chrome|black|white)/i.test(labels)) return 'color';
  if (/(nắp|đóng êm|rửa cơ|điện tử)/i.test(labels)) return 'seat_type';
  if (/(kích thước|size|mm|\d+x\d+)/i.test(labels)) return 'size';
  return 'configuration';
}

function deriveVariantLabel(product, rawProducts) {
  const raw = rawProducts.find((item) => item.source_url === product.source_url);
  const activeLabel = raw?.variants?.find((variant) => normalizeProductUrl(variant.url) === product.source_url || variant.active)?.clean_label;
  if (activeLabel) return activeLabel;
  const inboundLabel = rawProducts
    .flatMap((item) => item.variants || [])
    .find((variant) => normalizeProductUrl(variant.url) === product.source_url)?.clean_label;
  if (inboundLabel) return inboundLabel;
  const fromName = inferVariantLabelFromName(product.name, product.sku);
  if (fromName) return fromName;
  return product.sku;
}

function inferVariantLabelFromName(name, sku) {
  const text = `${name || ''} ${sku || ''}`;
  const suffix = String(sku || '').match(/\+([A-Z0-9-]+)$/i)?.[1];
  if (/nắp điện tử/i.test(text)) return ['Nắp điện tử', suffix].filter(Boolean).join(' ');
  if (/nắp rửa cơ/i.test(text)) return ['Nắp rửa cơ', suffix].filter(Boolean).join(' ');
  if (/nắp (?:đóng )?êm/i.test(text)) return ['Nắp êm', suffix].filter(Boolean).join(' ');
  if (suffix) return suffix;
  return null;
}

function buildCoverage(normalizedProducts) {
  const bySubcategory = groupBy(normalizedProducts, (product) => product.subcategory_id || 'unmapped');
  const filterCoverage = {};
  const pdpCoverage = {};

  for (const [subcategory, products] of Object.entries(bySubcategory)) {
    const expectedKeys = FILTER_KEYS_BY_SUBCATEGORY[subcategory] || ['product_type'];
    filterCoverage[subcategory] = {
      total: products.length,
      expected_filter_keys: expectedKeys,
      keys: Object.fromEntries(expectedKeys.map((key) => {
        const count = products.filter((product) => product.filter_specs && product.filter_specs[key]).length;
        return [key, { count, coverage: ratio(count, products.length) }];
      })),
      products_missing_filter_specs: products
        .filter((product) => !Object.keys(product.filter_specs || {}).length)
        .map((product) => ({ sku: product.sku, name: product.name, source_url: product.source_url })),
    };

    const fieldChecks = {
      sku: (product) => Boolean(product.sku),
      name: (product) => Boolean(product.name),
      slug: (product) => Boolean(product.slug),
      image_main_url: (product) => Boolean(product.image_main_url),
      description: (product) => Boolean(product.description),
      specs_3_plus: (product) => Object.keys(product.specs || {}).filter((key) => !['documents', 'Phụ kiện đi kèm', 'technologies'].includes(key)).length >= 3,
      documents: (product) => Boolean(product.specs?.documents?.length),
      box_includes: (product) => Boolean(product.specs?.['Phụ kiện đi kèm']?.length),
      price_or_display: (product) => Boolean(product.price || product.price_display),
      online_discount: (product) => Boolean(product.online_discount_amount),
      taxonomy_high_medium: (product) => !product.qa.includes('low_taxonomy_confidence') && !product.qa.includes('taxonomy_quarantine'),
      variant_group_when_applicable: (product) => !product.variant_group || products.filter((item) => item.variant_group === product.variant_group).length >= 2,
    };

    pdpCoverage[subcategory] = {
      total: products.length,
      fields: Object.fromEntries(Object.entries(fieldChecks).map(([key, check]) => {
        const count = products.filter(check).length;
        return [key, { count, coverage: ratio(count, products.length) }];
      })),
      qa_issues: products
        .filter((product) => product.qa.length)
        .map((product) => ({ sku: product.sku, issues: product.qa, source_url: product.source_url })),
    };
  }

  return { filterCoverage, pdpCoverage };
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function ratio(count, total) {
  return total ? Number((count / total).toFixed(3)) : 0;
}

function buildQaReport({ rawProducts, normalizedProducts, skippedProducts, variantReport, coverage }) {
  const bySubcategory = groupBy(normalizedProducts, (product) => product.subcategory_id || 'unmapped');
  const lines = [
    `# ${BRAND_SLUG} Sample Crawl QA Report`,
    '',
    `Brand: ${BRAND_SLUG}`,
    `Generated: ${new Date().toISOString()}`,
    `Target sample size: ${SAMPLE_MIN}-${SAMPLE_MAX} products/subcategory`,
    `Crawled selected products: ${normalizedProducts.length}`,
    `Skipped products: ${skippedProducts.length}`,
    '',
    '## Subcategory Counts',
    '',
    '| Subcategory | Count | Status |',
    '| --- | ---: | --- |',
  ];

  for (const [subcategory, products] of Object.entries(bySubcategory).sort()) {
    const count = products.length;
    const status = count >= SAMPLE_MIN && count <= SAMPLE_MAX + VARIANT_EXTRA_CAP_PER_SUBCATEGORY
      ? 'OK'
      : count < SAMPLE_MIN
        ? 'Needs more sample'
        : 'Above max because variant extras were included';
    lines.push(`| ${subcategory} | ${count} | ${status} |`);
  }

  lines.push(
    '',
    '## Price And Inactive Rules',
    '',
    `- Products with online discount: ${normalizedProducts.filter((product) => product.online_discount_amount).length}`,
    `- Products skipped because Hita says "Ngưng hoạt động": ${skippedProducts.filter((product) => product.skippedReason === 'inactive_on_hita').length}`,
    '',
    '## Variant Groups',
    '',
    `- Valid groups with at least 2 crawled products: ${variantReport.groups.length}`,
    `- Products with unresolved variant candidates: ${variantReport.unresolvedCandidates.filter((item) => !item.crawled_group_assigned).length}`,
    '',
    '## Main QA Issues',
    ''
  );

  const issueCounts = {};
  for (const product of normalizedProducts) {
    for (const issue of product.qa || []) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }

  if (Object.keys(issueCounts).length === 0) {
    lines.push('- No blocking QA issues found in normalized sample.');
  } else {
    for (const [issue, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${issue}: ${count}`);
    }
  }

  lines.push(
    '',
    '## Files',
    '',
    '- `urls-by-subcategory.json`',
    '- `sample-products.raw.json`',
    '- `sample-products.normalized.json`',
    '- `sample-taxonomy-map.json`',
    '- `sample-filter-coverage.json`',
    '- `sample-pdp-coverage.json`',
    '- `sample-variant-groups.json`',
    '- `sample-relationships.json`',
    '- `sample-assets.json`',
    '',
    '## Notes',
    '',
    '- Raw description HTML is preserved. Clean HTML removes obvious Hita CTA/contact/banner/video/placeholder content and flags Hita image URLs that still need CDN rewrite.',
    '- `variant_group` is assigned only when at least 2 products in the sample are connected by Hita variant links.',
    '- Taxonomy confidence is based on PDP breadcrumb, rough source URL/category signal, and product name/SKU/spec regex rules.'
  );

  return lines.join('\n');
}

// [LEO-471 #2] Retry transient crawl failures before giving up, so real
// products are not silently dropped on a flaky network/page load.
async function crawlProductWithRetry(context, candidate, attempts = 3) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await crawlProduct(context, candidate);
    if (result.skippedReason !== 'crawl_error') {
      if (attempt > 1) result.recovered_after_retries = attempt - 1;
      return result;
    }
    last = result;
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  return { ...last, retry_attempts: attempts };
}

async function main() {
  console.log(FULL_CRAWL
    ? `=== Hita full normalized crawl — brand=${BRAND_SLUG} limit=${CANDIDATE_LIMIT} ===`
    : `=== Hita sample crawl — brand=${BRAND_SLUG} min=${SAMPLE_MIN} max=${SAMPLE_MAX} ===`);
  console.log(`Output: ${SAMPLE_DIR}`);

  const candidates = loadCandidateUrls();
  console.log(`Candidate URLs: ${candidates.length}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    locale: 'vi-VN',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  });

  const queue = [...candidates];
  const queued = new Set(queue.map((candidate) => candidate.url));
  const crawled = new Set();
  const rawProducts = [];
  const skippedProducts = [];
  const subcategoryCounts = {};
  const variantExtraCounts = {};
  const limit = pLimit(CONCURRENCY);

  try {
    while (
      queue.length > 0 &&
      crawled.size < CANDIDATE_LIMIT &&
      (!TARGET_SUBCATEGORY || rawProducts.length < SAMPLE_MAX)
    ) {
      const batch = queue.splice(0, CONCURRENCY).filter((candidate) => !crawled.has(candidate.url));
      if (batch.length === 0) continue;

      const results = await Promise.all(batch.map((candidate) => limit(() => crawlProductWithRetry(context, candidate))));

      for (const result of results) {
        crawled.add(result.source_url || result.url);
        const subcategory = result.taxonomy?.subcategory_id || 'unmapped';

        if (result.skippedReason) {
          skippedProducts.push(result);
          console.log(`[skip] ${result.skippedReason} ${result.source_url}`);
          continue;
        }

        if (TARGET_SUBCATEGORY && subcategory !== TARGET_SUBCATEGORY) {
          skippedProducts.push({ ...result, skippedReason: `outside_target_subcategory:${subcategory}` });
          console.log(`[skip] outside_target_subcategory:${subcategory} ${result.sku} ${result.source_url}`);
          continue;
        }

        const count = subcategoryCounts[subcategory] || 0;
        const isVariantExtra = result.sample_reason === 'variant_from_selected_product';
        const extraCount = variantExtraCounts[subcategory] || 0;
        const canSelectBase = FULL_CRAWL || count < SAMPLE_MAX;
        const canSelectVariantExtra = !TARGET_SUBCATEGORY && !FULL_CRAWL && isVariantExtra && extraCount < VARIANT_EXTRA_CAP_PER_SUBCATEGORY;

        if ((canSelectBase || canSelectVariantExtra) && (!TARGET_SUBCATEGORY || rawProducts.length < SAMPLE_MAX)) {
          rawProducts.push(result);
          subcategoryCounts[subcategory] = count + 1;
          if (canSelectVariantExtra && !canSelectBase) variantExtraCounts[subcategory] = extraCount + 1;
          console.log(`[ok] ${subcategory} #${subcategoryCounts[subcategory]} ${result.sku} ${result.name}`);

          for (const variant of result.variants || []) {
            const url = normalizeProductUrl(variant.url);
            if (!url || queued.has(url) || crawled.has(url) || !isLikelyProductUrl(url)) continue;
            queue.unshift({
              url,
              source: `variant_of:${result.sku}`,
              reason: 'variant_from_selected_product',
            });
            queued.add(url);
          }
        }
      }

      await sleep(700);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const normalizedProducts = rawProducts.map(normalizeProduct);
  const variantReport = assignVariantGroups(normalizedProducts, rawProducts);
  const coverage = buildCoverage(normalizedProducts);

  const urlsBySubcategory = Object.fromEntries(
    Object.entries(groupBy(rawProducts, (product) => product.taxonomy?.subcategory_id || 'unmapped')).map(([subcategory, products]) => [
      subcategory,
      products.map((product) => ({
        url: product.source_url,
        sku: product.sku,
        name: product.name,
        sample_reason: product.sample_reason,
        taxonomy_confidence: product.taxonomy?.confidence,
      })),
    ])
  );

  const taxonomyMap = normalizedProducts.map((product) => {
    const raw = rawProducts.find((item) => item.source_url === product.source_url);
    return {
      sku: product.sku,
      name: product.name,
      source_url: product.source_url,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id,
      product_type: product.product_type,
      product_sub_type: product.product_sub_type,
      confidence: raw?.taxonomy?.confidence,
      sources: raw?.taxonomy?.sources,
      reasons: raw?.taxonomy?.reasons,
      quarantine_reason: raw?.taxonomy?.quarantine_reason,
    };
  });

  const relationshipCandidates = normalizedProducts
    .filter((product) => product.relationship_candidates.length)
    .map((product) => ({
      sku: product.sku,
      source_url: product.source_url,
      relationship_candidates: product.relationship_candidates,
    }));

  const assets = normalizedProducts.map((product) => ({
    sku: product.sku,
    source_url: product.source_url,
    image_main_url: product.image_main_url,
    product_images: product.product_images,
    documents: product.specs.documents || [],
    description_clean_issues: product.description_clean_issues,
  }));

  fs.mkdirSync(SAMPLE_DIR, { recursive: true });
  atomicWrite(path.join(SAMPLE_DIR, 'urls-by-subcategory.json'), urlsBySubcategory);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-products.raw.json'), rawProducts);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-products.normalized.json'), normalizedProducts);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-taxonomy-map.json'), taxonomyMap);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-filter-coverage.json'), coverage.filterCoverage);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-pdp-coverage.json'), coverage.pdpCoverage);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-variant-groups.json'), variantReport);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-relationships.json'), relationshipCandidates);
  atomicWrite(path.join(SAMPLE_DIR, 'sample-assets.json'), assets);

  // [LEO-471 #1] Persist EVERY skipped product + reason so coverage is provable.
  const skippedDetail = skippedProducts.map((product) => ({
    source_url: product.source_url || product.url || null,
    sku: product.sku || null,
    name: product.name || null,
    skipped_reason: product.skippedReason || 'unknown',
    error: product.error || null,
  }));
  const skipBreakdown = skippedDetail.reduce((acc, item) => {
    acc[item.skipped_reason] = (acc[item.skipped_reason] || 0) + 1;
    return acc;
  }, {});
  atomicWrite(path.join(SAMPLE_DIR, 'sample-skipped.json'), {
    total_skipped: skippedDetail.length,
    breakdown: skipBreakdown,
    items: skippedDetail,
  });

  fs.writeFileSync(
    path.join(SAMPLE_DIR, 'sample-qa-report.md'),
    buildQaReport({ rawProducts, normalizedProducts, skippedProducts, variantReport, coverage }),
    'utf8'
  );

  console.log('\n=== Summary ===');
  console.log(`Selected products: ${normalizedProducts.length}`);
  console.log(`Skipped products: ${skippedProducts.length}`);
  console.log(`Skip breakdown: ${JSON.stringify(skipBreakdown)}`);
  console.log(`Variant groups: ${variantReport.groups.length}`);
  console.log(`Saved ${FULL_CRAWL ? 'full normalized' : 'sample'} audit files to ${SAMPLE_DIR}`);
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
