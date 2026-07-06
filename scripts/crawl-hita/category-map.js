/**
 * @file category-map.js
 * @description Mapping table: hita.com.vn breadcrumb URL paths → DPG category/subcategory IDs.
 *
 * IMPORTANT:
 *   After a read-only prepare run, inspect discovery/reconciliation artifacts
 *   and add any missing breadcrumb mappings here before any execute import.
 *   The crawler logs a warning for every unmapped URL.
 *
 * Key   = URL path from breadcrumb `href` (e.g. '/bon-cau-253.html')
 * Value = { subcategory_id, product_type }
 *   subcategory_id : slug matching DPG subcategories.slug
 *   product_type   : string matching DPG product_type enum, or null
 */

export const CATEGORY_MAP = {
  // ── Bồn Cầu (all brands) ──────────────────────────────────────────────────
  '/bon-cau-253.html':                  { subcategory_id: 'bon-cau', product_type: null },
  '/bon-cau-1-khoi-260.html':           { subcategory_id: 'bon-cau', product_type: 'bon-cau-1-khoi' },
  '/bon-cau-2-khoi-261.html':           { subcategory_id: 'bon-cau', product_type: 'bon-cau-2-khoi' },
  '/bon-cau-treo-tuong-262.html':       { subcategory_id: 'bon-cau', product_type: 'bon-cau-treo-tuong' },
  '/bon-cau-treo-tuong-xxx.html':       { subcategory_id: 'bon-cau', product_type: 'bon-cau-treo-tuong' },
  '/bon-cau-dat-san.html':              { subcategory_id: 'bon-cau', product_type: 'bon-cau-dat-san' },
  '/bon-cau-xom.html':                  { subcategory_id: 'bon-cau', product_type: 'bon-cau-xom' },
  '/bon-cau-thong-minh-365.html':       { subcategory_id: 'bon-cau', product_type: 'bon-cau-thong-minh' },
  '/bon-cau-nap-rua-co-368.html':       { subcategory_id: 'bon-cau', product_type: 'bon-cau-thong-minh' },
  '/phu-kien-bon-cau.html':             { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },

  // CAESAR-specific bồn cầu paths.
  '/bon-cau-caesar-384.html':           { subcategory_id: 'bon-cau', product_type: null },
  '/bon-cau-1-khoi-caesar.html':        { subcategory_id: 'bon-cau', product_type: 'bon-cau-1-khoi' },
  '/bon-cau-2-khoi-caesar.html':        { subcategory_id: 'bon-cau', product_type: 'bon-cau-2-khoi' },

  // COTTO bồn cầu
  '/bon-cau-cotto.html':                { subcategory_id: 'bon-cau', product_type: null },

  // GROHE bồn cầu
  '/bon-cau-grohe.html':                { subcategory_id: 'bon-cau', product_type: null },

  // Viglacera bồn cầu
  '/bon-cau-viglacera.html':            { subcategory_id: 'bon-cau', product_type: null },

  // ATMOR bồn cầu
  '/bon-cau-atmor.html':                { subcategory_id: 'bon-cau', product_type: null },

  // American Standard bồn cầu
  '/bon-cau-american-standard.html':    { subcategory_id: 'bon-cau', product_type: null },

  // ── Nắp Bồn Cầu ───────────────────────────────────────────────────────────
  '/nap-bon-cau-357.html':              { subcategory_id: 'nap-bon-cau', product_type: null },
  '/nap-rua-co-264.html':               { subcategory_id: 'nap-bon-cau', product_type: 'nap-rua-co' },
  '/nap-bon-cau-thuong-358.html':       { subcategory_id: 'nap-bon-cau', product_type: 'nap-thuong-dong-em' },
  '/nap-bon-cau-thong-minh-450.html':   { subcategory_id: 'nap-bon-cau', product_type: 'nap-dien-tu' },

  // ── Lavabo / Chậu Rửa Mặt ────────────────────────────────────────────────
  '/chau-rua-mat-lavabo-254.html':          { subcategory_id: 'lavabo', product_type: null },
  '/chau-rua-mat-lavabo-am-ban-270.html':   { subcategory_id: 'lavabo', product_type: 'lavabo-am-ban' },
  '/chau-rua-mat-lavabo-treo-tuong-267.html': { subcategory_id: 'lavabo', product_type: 'lavabo-treo-tuong' },
  '/chau-rua-mat-lavabo-duong-vanh-271.html': { subcategory_id: 'lavabo', product_type: 'lavabo-duong-vanh' },
  '/chau-rua-mat-lavabo-dat-ban-266.html':  { subcategory_id: 'lavabo', product_type: 'lavabo-dat-ban' },
  '/chau-rua-mat-lavabo-ban-am-ban-272.html': { subcategory_id: 'lavabo', product_type: 'lavabo-ban-am' },
  '/chan-chau-lavabo.html':             { subcategory_id: 'lavabo', product_type: 'chan-chau-lavabo' },

  // CAESAR lavabo
  '/chau-rua-mat-lavabo-caesar-391.html':   { subcategory_id: 'lavabo', product_type: null },

  // COTTO lavabo
  '/chau-rua-lavabo-cotto.html':            { subcategory_id: 'lavabo', product_type: null },

  // GROHE lavabo
  '/chau-rua-lavabo-grohe.html':            { subcategory_id: 'lavabo', product_type: null },

  // Viglacera lavabo
  '/chau-rua-mat-viglacera.html':           { subcategory_id: 'lavabo', product_type: null },

  // American Standard lavabo
  '/chau-rua-lavabo-american-standard.html': { subcategory_id: 'lavabo', product_type: null },

  // ── Sen Tắm ───────────────────────────────────────────────────────────────
  '/sen-tam-289.html':                  { subcategory_id: 'sen-tam', product_type: null },
  '/cu-sen-tam.html':                   { subcategory_id: 'sen-tam', product_type: 'cu-sen' },
  '/sen-tam-grohe.html':                { subcategory_id: 'sen-tam', product_type: null },
  '/sen-am-tuong-grohe.html':           { subcategory_id: 'sen-tam', product_type: 'sen-am-tuong' },
  '/bat-sen.html':                      { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/sen-tam-am-tuong-288.html':         { subcategory_id: 'sen-tam', product_type: 'sen-am-tuong' },
  '/tay-sen-tam-286.html':              { subcategory_id: 'sen-tam', product_type: 'tay-sen' },
  '/bo-sen-tam.html':                   { subcategory_id: 'sen-tam', product_type: 'bo-sen-tam' },
  '/cu-sen-tam-cotto.html':             { subcategory_id: 'sen-tam', product_type: 'cu-sen' },
  '/thanh-truot-sen-tam.html':          { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/can-sen-thanh-noi-bat-sen.html':    { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/cut-noi-tuong-tay-sen.html':        { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/van-chia-nuoc-khoa-nuoc.html':       { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/phu-kien-sen-voi-291.html':         { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/sen-tam-nhiet-do.html':             { subcategory_id: 'sen-tam', product_type: null },
  '/voi-xa-bon-am-tuong.html':          { subcategory_id: 'bon-tam', product_type: 'voi-xa-bon' },

  // ── Vòi Chậu ──────────────────────────────────────────────────────────────
  '/voi-lavabo-284.html':               { subcategory_id: 'voi-chau', product_type: null },
  '/voi-ho-287.html':                   { subcategory_id: 'voi-chau', product_type: 'voi-gan-tuong' },
  '/voi-lavabo-nong-lanh.html':         { subcategory_id: 'voi-chau', product_type: 'voi-nong-lanh' },
  '/phu-kien-voi-chau.html':            { subcategory_id: 'voi-chau', product_type: 'phu-kien-voi' },
  '/voi-lavabo-caesar-411.html':        { subcategory_id: 'voi-chau', product_type: null },
  '/voi-lavabo-american-standard.html': { subcategory_id: 'voi-chau', product_type: null },

  // ── Bồn Tiểu / Phụ Kiện ──────────────────────────────────────────────────
  '/van-xa-tieu-276.html':              { subcategory_id: 'bon-tieu', product_type: 'van-xa-tieu' },
  '/bon-tieu-nam-caesar-397.html':      { subcategory_id: 'bon-tieu', product_type: 'bon-tieu-nam' },
  '/bon-tieu-nam-cotto.html':           { subcategory_id: 'bon-tieu', product_type: 'bon-tieu-nam' },
  '/bon-tieu-nam-atmor.html':           { subcategory_id: 'bon-tieu', product_type: 'bon-tieu-nam' },

  // ── Phễu Thoát / Phụ Kiện Phòng Tắm ─────────────────────────────────────
  '/pheu-thoat-san-293.html':           { subcategory_id: 'phu-kien-phong-tam', product_type: 'pheu-thoat-san' },
  '/phu-kien-nha-tam-258.html':         { subcategory_id: 'phu-kien-phong-tam', product_type: null },
  '/hop-xit-xa-phong-305.html':         { subcategory_id: 'phu-kien-phong-tam', product_type: 'hop-xa-phong' },
  '/lo-hop-dung-giay-ve-sinh-296.html': { subcategory_id: 'phu-kien-phong-tam', product_type: 'hop-giay-ve-sinh' },
  '/ke-dung-xa-phong-298.html':         { subcategory_id: 'phu-kien-phong-tam', product_type: 'ke-xa-phong' },
  '/moc-ao-297.html':                   { subcategory_id: 'phu-kien-phong-tam', product_type: 'moc-ao' },
  '/thanh-treo-khan-292.html':          { subcategory_id: 'phu-kien-phong-tam', product_type: 'thanh-treo-khan' },
  '/lo-ban-chai-299.html':              { subcategory_id: 'phu-kien-phong-tam', product_type: 'lo-ban-chai' },
  '/bo-phu-kien.html':                  { subcategory_id: 'phu-kien-phong-tam', product_type: 'bo-phu-kien' },
  '/nhung-phu-kien-khac-303.html':      { subcategory_id: 'phu-kien-phong-tam', product_type: 'phu-kien-khac' },
  '/vong-treo-khan-295.html':           { subcategory_id: 'phu-kien-phong-tam', product_type: 'vong-treo-khan' },
  '/thanh-tay-vin.html':                { subcategory_id: 'phu-kien-phong-tam', product_type: 'thanh-tay-vin' },

  // ── Van Điều Chỉnh (COTTO, GROHE, MOEN, American Standard) ───────────────
  '/van-dieu-chinh.html':               { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/bo-sen-am-tuong-2-duong-nuoc.html': { subcategory_id: 'sen-tam', product_type: 'sen-am-tuong' },

  // ── Vòi Bồn Tắm ───────────────────────────────────────────────────────────
  '/voi-bon-tam-322.html':              { subcategory_id: 'bon-tam', product_type: 'voi-bon-tam' },
  '/phu-kien-bon-tam.html':             { subcategory_id: 'bon-tam', product_type: 'phu-kien-bon-tam' },
  '/bon-tam-xay.html':                  { subcategory_id: 'bon-tam', product_type: 'bon-tam-xay' },

  // ── Vòi Xịt Vệ Sinh ──────────────────────────────────────────────────────
  '/voi-xit-ve-sinh-301.html':          { subcategory_id: 'phu-kien-phong-tam', product_type: 'voi-xit-ve-sinh' },

  // ── Bộ Sen Âm Tường (American Standard, GROHE) ────────────────────────────
  '/bo-sen-am-tuong-3-duong-nuoc.html': { subcategory_id: 'sen-tam', product_type: 'sen-am-tuong' },

  // ── Khu Công Cộng (commercial accessories — still maps to phu-kien) ───────
  '/khu-cong-cong-259.html':            { subcategory_id: 'phu-kien-phong-tam', product_type: null },

  // ── Combo Thiết Bị Vệ Sinh ────────────────────────────────────────────────
  '/combo-thiet-bi-ve-sinh-371.html':   { subcategory_id: 'combo-thiet-bi-ve-sinh', product_type: 'combo-thiet-bi-ve-sinh' },

  // ── Bồn Tắm ───────────────────────────────────────────────────────────────
  '/bon-tam-caesar-401.html':           { subcategory_id: 'bon-tam', product_type: null },
  '/bon-tam-256.html':                  { subcategory_id: 'bon-tam', product_type: null },
  '/bon-tam-chan-yem.html':             { subcategory_id: 'bon-tam', product_type: 'bon-tam-chan-yem' },
  '/bon-tam-massage.html':              { subcategory_id: 'bon-tam', product_type: 'bon-tam-massage' },
  '/bon-tam-dat-san.html':              { subcategory_id: 'bon-tam', product_type: 'bon-tam-dat-san' },
  '/bon-tam-dung.html':                 { subcategory_id: 'bon-tam', product_type: 'bon-tam' },
  '/de-va-xa-phong-tam.html':           { subcategory_id: 'bon-tam', product_type: 'phu-kien-bon-tam' },

  // ── Tủ Chậu / Cabinet ─────────────────────────────────────────────────────
  '/tu-chau-cabinet-273.html':          { subcategory_id: 'lavabo', product_type: 'tu-chau' },
  '/tu-ke-nha-tam.html':                { subcategory_id: 'lavabo', product_type: 'tu-chau' },
  '/tu-chau-cabinet-caesar.html':       { subcategory_id: 'lavabo', product_type: 'tu-chau' },
  '/tu-guong.html':                     { subcategory_id: 'lavabo', product_type: 'tu-chau' },
  '/bo-tu-chau-tu-guong.html':          { subcategory_id: 'lavabo', product_type: 'tu-chau' },

  // ── Phụ Kiện / Linh Kiện Bồn Cầu ──────────────────────────────────────────
  '/ket-nuoc.html':                     { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },
  '/bo-xa-bon-cau.html':                { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },
  '/van-xa-bon-cau.html':               { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },
  '/than-su.html':                      { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },
  '/de-cau-con-tho-bon-cau.html':       { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },
  '/linh-kien-lap-bon-cau-nap-cau.html': { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },
  '/day-cap-nuoc.html':                 { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },
  '/tay-gat-nut-nhan-bon-cau.html':     { subcategory_id: 'bon-cau', product_type: 'phu-kien-bon-cau' },

  // ── Bồn Tiểu Nam ──────────────────────────────────────────────────────────
  '/bon-tieu-nam-274.html':             { subcategory_id: 'bon-tieu', product_type: 'bon-tieu-nam' },
  '/bon-tieu-nu.html':                  { subcategory_id: 'bon-tieu', product_type: 'bon-tieu-nu' },
  '/bon-tieu-255.html':                 { subcategory_id: 'bon-tieu', product_type: null },
  '/phu-kien-bon-tieu.html':            { subcategory_id: 'bon-tieu', product_type: 'phu-kien-bon-tieu' },

  // ── Sen Cây / Tay Sen ─────────────────────────────────────────────────────
  '/sen-cay-285.html':                  { subcategory_id: 'sen-tam', product_type: 'bo-sen-cay' },
  '/sen-cay-caesar.html':               { subcategory_id: 'sen-tam', product_type: 'bo-sen-cay' },
  '/day-sen.html':                      { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },
  '/gac-sen-tam.html':                  { subcategory_id: 'sen-tam', product_type: 'phu-kien-sen-voi' },

  // ── Phụ Kiện Phòng Tắm phổ thông ─────────────────────────────────────────
  '/guong-soi-phong-tam-300.html':      { subcategory_id: 'phu-kien-phong-tam', product_type: 'guong-phong-tam' },
  '/ke-kinh-302.html':                  { subcategory_id: 'phu-kien-phong-tam', product_type: 'phu-kien-khac' },
  '/co-cau.html':                       { subcategory_id: 'phu-kien-phong-tam', product_type: 'phu-kien-khac' },
  '/day-gian-phoi-do.html':             { subcategory_id: 'phu-kien-phong-tam', product_type: 'phu-kien-khac' },

  // ── Máy Sấy Tay (ATMOR) ───────────────────────────────────────────────────
  '/dien-gia-dung-590.html':            { subcategory_id: null, product_type: null },
  '/may-say-tay.html':                  { subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay' },
  '/may-say-tay-294.html':              { subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay' },
  '/may-say-tay-atmor.html':            { subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay' },

  // ── Máy Nước Nóng (ATMOR) ─────────────────────────────────────────────────
  '/may-nuoc-nong-truc-tiep.html':      { subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  '/may-nuoc-nong-gian-tiep.html':      { subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-gian-tiep' },
  '/may-nuoc-nong-atmor.html':          { subcategory_id: 'may-nuoc-nong', product_type: null },

  // ── Thanh Tay Vịn Gắn Bồn Tắm (MOEN) ────────────────────────────────────
  '/thanh-tay-vin-gan-thanh-bon-tam.html': { subcategory_id: 'phu-kien-phong-tam', product_type: 'thanh-tay-vin' },

  // ── Gạch / Ecocarat / vật liệu ốp gạch (INAX lane trên Hita) ────────────
  '/gach.html':                           { category_id: 'gach-op-lat', subcategory_id: 'gach-op-lat', product_type: null },
  '/gach-ho-boi.html':                    { category_id: 'gach-op-lat', subcategory_id: 'gach-op-lat', product_type: null },
  '/gach-op-tuong.html':                  { category_id: 'gach-op-lat', subcategory_id: 'gach-op-tuong', product_type: null },
  '/ecocarat.html':                       { category_id: 'gach-op-lat', subcategory_id: 'gach-inax-ecocarat', product_type: null },
  '/vat-lieu-op-gach.html':               { category_id: 'gach-op-lat', subcategory_id: 'gach-op-lat', product_type: null },

  // ── Thiết bị bếp (category riêng — subcategory_id = null, dùng bep_product_types) ──
  // category_id = 'thiet-bi-bep', subcategory_id = null (bep schema khác thiet-bi-ve-sinh)
  '/voi-rua-chen-bat-283.html':         { category_id: 'thiet-bi-bep', subcategory_id: null, product_type: 'voi-rua-chen' },
  '/thiet-bi-bep-581.html':             { category_id: 'thiet-bi-bep', subcategory_id: null, product_type: null },
  '/voi-bep-caesar.html':               { category_id: 'thiet-bi-bep', subcategory_id: null, product_type: 'voi-rua-chen' },
  '/phu-kien-voi-rua-chen-bat.html':    { category_id: 'thiet-bi-bep', subcategory_id: 'voi-rua-chen', product_type: 'phu-kien-voi-rua-chen' },
  '/tu-bep.html':                       { category_id: 'thiet-bi-bep', subcategory_id: 'thiet-bi-bep-khac', product_type: 'tu-bep' },
  '/chau-rua-chen-348.html':            { category_id: 'thiet-bi-bep', subcategory_id: 'chau-rua-chen', product_type: 'chau-rua-chen' },
  '/may-rua-chen-282.html':             { category_id: 'thiet-bi-bep', subcategory_id: null, product_type: 'may-rua-chen' },
  '/bep-gas-279.html':                  { category_id: 'thiet-bi-bep', subcategory_id: null, product_type: 'bep-gas' },
  '/bep-dien-bep-tu-280.html':          { category_id: 'thiet-bi-bep', subcategory_id: null, product_type: 'bep-dien-bep-tu' },
  '/may-hut-mui-281.html':              { category_id: 'thiet-bi-bep', subcategory_id: null, product_type: 'may-hut-mui' },
};

/**
 * Look up the DPG category for a hita breadcrumb URL (or full URL).
 *
 * Returns { category_id, subcategory_id, product_type }.
 * category_id defaults to 'thiet-bi-ve-sinh' if not specified in the map entry.
 *
 * @param {string} hitaBreadcrumbUrl - URL or path from the breadcrumb `href`.
 * @returns {{ category_id: string, subcategory_id: string|null, product_type: string|null } | null}
 */
export function lookupCategory(hitaBreadcrumbUrl) {
  if (!hitaBreadcrumbUrl) return null;

  let urlPath;
  try {
    urlPath = new URL(hitaBreadcrumbUrl, 'https://hita.com.vn').pathname;
  } catch {
    urlPath = hitaBreadcrumbUrl;
  }

  const normalized = urlPath.replace(/\/$/, '') || '/';
  const entry = CATEGORY_MAP[normalized] ?? null;

  if (!entry) {
    console.warn(
      `[category-map] ⚠️  No mapping for: "${normalized}" — add to CATEGORY_MAP. Using null.`
    );
    return null;
  }

  return {
    category_id: entry.category_id || 'thiet-bi-ve-sinh', // default: bathroom
    subcategory_id: entry.subcategory_id || null,
    product_type: entry.product_type || null,
  };
}
