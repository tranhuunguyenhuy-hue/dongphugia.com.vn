/**
 * @file category-map.js
 * @description Mapping table from hita.com.vn URL paths → DPG category/subcategory IDs.
 *
 * Sources:
 *   - LEO-448 Phase 0 Re-run (FINAL SPEC)
 */

// ---------------------------------------------------------------------------
// Mapping table
// ---------------------------------------------------------------------------

/**
 * hita URL path → DPG category mapping.
 *
 * Key:   URL path as found in breadcrumb `href` attribute (e.g. `/bon-cau-253.html`).
 * Value: Object with `subcategory_id` and `product_type` matching DPG taxonomy.
 *
 * @type {Record<string, { subcategory_id: string, product_type: string | null, note?: string }>}
 */
export const CATEGORY_MAP = {
  // ── Bồn Cầu ───────────────────────────────────────────────────────────────
  '/bon-cau-253.html': { subcategory_id: 'bon-cau', product_type: null },
  '/bon-cau-1-khoi-260.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-1-khoi' },
  '/bon-cau-2-khoi-261.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-2-khoi' },
  '/bon-cau-treo-tuong-xxx.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-treo-tuong' },
  '/bon-cau-treo-tuong-262.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-treo-tuong' },
  '/bon-cau-dat-san.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-dat-san' },
  '/bon-cau-xom.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-xom' },
  '/bon-cau-thong-minh-365.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-thong-minh' },
  '/bon-cau-nap-rua-co-368.html': { subcategory_id: 'bon-cau', product_type: 'bon-cau-thong-minh' },
  '/phu-kien-bon-cau.html': { subcategory_id: 'phu-kien-bon-cau', product_type: null },

  // ── Nắp Bồn Cầu ───────────────────────────────────────────────────────────
  '/nap-bon-cau-357.html': { subcategory_id: 'nap-bon-cau', product_type: null },
  '/nap-rua-co-264.html': { subcategory_id: 'nap-bon-cau', product_type: 'nap-rua-co' },
  '/nap-bon-cau-thuong-358.html': { subcategory_id: 'nap-bon-cau', product_type: 'nap-thuong-dong-em' },
  '/nap-bon-cau-thong-minh-450.html': { subcategory_id: 'nap-bon-cau', product_type: 'nap-dien-tu' },

  // ── Lavabo / Chậu Rửa Mặt ────────────────────────────────────────────────
  '/chau-rua-mat-lavabo-254.html': { subcategory_id: 'lavabo', product_type: null },
  '/chau-rua-mat-lavabo-am-ban-270.html': { subcategory_id: 'lavabo', product_type: 'lavabo-am-ban' },
  '/chau-rua-mat-lavabo-treo-tuong-267.html': { subcategory_id: 'lavabo', product_type: 'lavabo-treo-tuong' },
  '/chau-rua-mat-lavabo-duong-vanh-271.html': { subcategory_id: 'lavabo', product_type: 'lavabo-duong-vanh' },
  '/chau-rua-mat-lavabo-dat-ban-266.html': { subcategory_id: 'lavabo', product_type: 'lavabo-dat-ban' },
  '/chau-rua-mat-lavabo-ban-am-ban-272.html': { subcategory_id: 'lavabo', product_type: 'lavabo-ban-am' },

  // ── Sen Tắm ───────────────────────────────────────────────────────────────
  '/sen-tam-289.html': { subcategory_id: 'sen-tam', product_type: null },
  '/cu-sen-tam.html': { subcategory_id: 'sen-tam', product_type: 'cu-sen' },

  // ── Phụ Kiện / Bồn Tiểu / Vòi / Phễu ──────────────────────────────────────
  '/van-xa-tieu-276.html': { subcategory_id: 'bon-tieu', product_type: 'phu-kien-bon-tieu' },
  '/phu-kien-voi-chau.html': { subcategory_id: 'voi-chau', product_type: 'phu-kien-voi', note: 'hita chỉ có 1 cấp breadcrumb — product_type hardcoded' },
  '/voi-lavabo-284.html': { subcategory_id: 'voi-chau', product_type: null },
  '/voi-ho-287.html': { subcategory_id: 'voi-chau', product_type: 'voi-gan-tuong' },
  '/voi-lavabo-nong-lanh.html': { subcategory_id: 'voi-chau', product_type: 'voi-nong-lanh' },
  '/pheu-thoat-san-293.html': { subcategory_id: 'phu-kien-phong-tam', product_type: null },
};

// ---------------------------------------------------------------------------
// Lookup function
// ---------------------------------------------------------------------------

/**
 * Look up the DPG category for a hita breadcrumb URL (or full URL).
 *
 * @param {string} hitaBreadcrumbUrl - URL or path from the breadcrumb `href`.
 * @returns {{ subcategory_id: string, product_type: string | null } | null}
 */
export function lookupCategory(hitaBreadcrumbUrl) {
  if (!hitaBreadcrumbUrl) return null;

  // Normalize: extract pathname from full URL or use as-is
  let urlPath;
  try {
    urlPath = new URL(hitaBreadcrumbUrl, 'https://hita.com.vn').pathname;
  } catch {
    urlPath = hitaBreadcrumbUrl;
  }

  // Normalize trailing slash variants
  const normalized = urlPath.replace(/\/$/, '') || '/';

  const result = CATEGORY_MAP[normalized] ?? null;

  if (!result) {
    console.warn(
      `[category-map] No mapping found for breadcrumb URL: "${normalized}". ` +
        `Setting subcategory_id = null. Add entry to CATEGORY_MAP if needed.`
    );
  }

  return result;
}
