/**
 * @file brand-configs.js
 * @description Brand configuration for the shared hita.com.vn crawl pipeline.
 *
 * Each brand entry defines:
 *   - slug          : DPG brands.slug value in Supabase
 *   - brandPageUrl  : Landing page on hita listing all brand products (for Phase 1B)
 *   - sitemapKeyword: Substring to filter URLs from sitemap (Phase 1A, case-insensitive)
 *   - sampleUrls    : 20 representative PDPs used in Phase 0 (--sample-only gate)
 *                     → Antigravity: populate from Phase 1 output before first run
 *
 * Usage:
 *   import { getBrandConfig } from './brand-configs.js';
 *   const config = getBrandConfig('caesar');
 */

export const BRAND_CONFIGS = {
  caesar: {
    slug: 'caesar',
    brandPageUrl: 'https://hita.com.vn/thiet-bi-ve-sinh-caesar-383.html',
    sitemapKeyword: 'caesar',
    sampleUrls: [
      // Bồn cầu 1 khối
      'https://hita.com.vn/bon-cau-1-khoi-caesar-c1353-2641.html',
      'https://hita.com.vn/bon-cau-1-khoi-caesar-c1366-2644.html',
      // Bồn cầu 2 khối
      'https://hita.com.vn/bon-cau-2-khoi-caesar-cd1340-2675.html',
      'https://hita.com.vn/bon-cau-2-khoi-caesar-cd1388-7417.html',
      // Lavabo đặt bàn
      'https://hita.com.vn/lavabo-duong-ban-caesar-lf5038-2805.html',
      'https://hita.com.vn/chau-rua-lavabo-dat-ban-caesar-lf5259-7618.html',
      // Tủ chậu cabinet
      'https://hita.com.vn/tu-chau-cabinet-caesar-lf5255-eh05255av-2669.html',
      'https://hita.com.vn/bo-tu-chau-cabinet-treo-mau-hong-caesar-lf5017-eh05017apv-7515.html',
      // Vòi lavabo
      'https://hita.com.vn/voi-chau-lavabo-caesar-b260cp-2712.html',
      'https://hita.com.vn/voi-lavabo-nong-lanh-bo-xa-nhan-caesar-b225cu-7455.html',
      // Sen tắm / bộ sen
      'https://hita.com.vn/bo-sen-cay-tam-dung-nong-lanh-caesar-bs126-s553c-12789.html',
      'https://hita.com.vn/bo-sen-tam-nong-lanh-caesar-s383c-7494.html',
      // Bồn tắm
      'https://hita.com.vn/bon-tam-massage-caesar-mt0660c-2826.html',
      'https://hita.com.vn/bon-tam-co-chan-yem-caesar-at0570l-r-7393.html',
      // Bồn tiểu nam
      'https://hita.com.vn/bon-tieu-nam-treo-tuong-caesar-u0210-2932.html',
      // Vòi rửa chén
      'https://hita.com.vn/voi-rua-chen-bat-caesar-k745c-2847.html',
      // Đầu phun nước (shower head)
      'https://hita.com.vn/dau-phun-nuoc-caesar-13115mac-18161.html',
      // Nắp két nước (phụ kiện)
      'https://hita.com.vn/nap-ket-nuoc-caesar-t1140-1-pw-17711.html',
      // Bộ két nước
      'https://hita.com.vn/bo-ket-nuoc-caesar-th1510a-pw-18848.html',
      // Thân két nước
      'https://hita.com.vn/than-ket-nuoc-caesar-t1100-pw-19375.html',
    ],
  },

  'american-standard': {
    slug: 'american-standard',
    brandPageUrl: 'https://hita.com.vn/american-standard.html',
    sitemapKeyword: 'american-standard',
    sampleUrls: [
      // Bồn cầu 1 khối
      'https://hita.com.vn/bon-cau-1-khoi-american-standard-nobile-wp-2060-9366.html',
      'https://hita.com.vn/bon-cau-american-standard-1-khoi-2007-wt-9371.html',
      // Bồn cầu 2 khối
      'https://hita.com.vn/bon-cau-2-khoi-american-standard-compact-codie-2407-wt-9384.html',
      // Bồn cầu nắp điện tử
      'https://hita.com.vn/bon-cau-nap-dien-tu-american-standard-vf-1808pl-9420.html',
      // Bồn cầu nắp rửa cơ
      'https://hita.com.vn/bon-cau-nap-rua-co-american-standard-vf-1858s-9447.html',
      // Nắp bồn cầu đóng êm
      'https://hita.com.vn/nap-bon-cau-dong-em-american-standard-491000s-wt-2530-wt-vf-2530-2407-wt-21635.html',
      // Bộ xả bồn cầu (phụ kiện)
      'https://hita.com.vn/bo-xa-bon-cau-american-standard-m12314-vf-1808et-vf-1808t-21655.html',
      // Lavabo đặt bàn
      'https://hita.com.vn/chau-rua-lavabo-dat-ban-american-standard-wp-f525-9471.html',
      // Lavabo âm bàn
      'https://hita.com.vn/chau-rua-mat-lavabo-am-ban-concept-american-standard-0433-wt-11821.html',
      // Vòi lavabo nóng lạnh
      'https://hita.com.vn/voi-lavabo-nong-lanh-american-standard-cygnet-wf-0301-9517.html',
      // Bộ sen âm nhiệt độ
      'https://hita.com.vn/bo-sen-am-nhiet-do-3-duong-american-standard-easyset-enjoyment-polished-cool-sunrise-22518.html',
      // Thân sứ cầu (phụ kiện)
      'https://hita.com.vn/than-su-cau-1-khoi-american-standard-2530b-wt-2530-wt-21587.html',
      // Fill to 20
      'https://hita.com.vn/bon-cau-1-khoi-american-standard-nobile-wp-2060-9366.html',
      'https://hita.com.vn/voi-lavabo-nong-lanh-american-standard-cygnet-wf-0301-9517.html',
      'https://hita.com.vn/bon-cau-2-khoi-american-standard-compact-codie-2407-wt-9384.html',
      'https://hita.com.vn/chau-rua-lavabo-dat-ban-american-standard-wp-f525-9471.html',
      'https://hita.com.vn/bon-cau-nap-dien-tu-american-standard-vf-1808pl-9420.html',
      'https://hita.com.vn/bon-cau-nap-rua-co-american-standard-vf-1858s-9447.html',
      'https://hita.com.vn/bon-cau-american-standard-1-khoi-2007-wt-9371.html',
      'https://hita.com.vn/nap-bon-cau-dong-em-american-standard-491000s-wt-2530-wt-vf-2530-2407-wt-21635.html',
    ],
  },

  cotto: {
    slug: 'cotto',
    brandPageUrl: 'https://hita.com.vn/cotto.html',
    sitemapKeyword: 'cotto',
    sampleUrls: [
      // Lavabo
      'https://hita.com.vn/chau-rua-lavabo-cotto-dat-ban-c001057-10351.html',
      'https://hita.com.vn/chau-rua-lavabo-cotto-dat-ban-c001057-10351.html',
      // Vòi lavabo
      'https://hita.com.vn/voi-chau-lavabo-cotto-ct1131a-hm-nuoc-lanh-scirocco-13753.html',
      'https://hita.com.vn/voi-lavabo-nong-lanh-cotto-ct202ay-10573.html',
      'https://hita.com.vn/voi-lavabo-lanh-cotto-ct167d-hm-10528.html',
      'https://hita.com.vn/voi-lavabo-cam-ung-cotto-gan-tuong-dung-dien-ct539ac-ld-10625.html',
      // Bồn cầu
      'https://hita.com.vn/bon-cau-2-khoi-cotto-xa-khong-cham-c135137-10164.html',
      'https://hita.com.vn/bon-cau-1-khoi-cotto-xa-khong-cham-c110517-10163.html',
      // Bồn tiểu nam
      'https://hita.com.vn/bon-tieu-nam-cotto-treo-tuong-c3010-10466.html',
      // Van điều chỉnh
      'https://hita.com.vn/van-dieu-chinh-am-tuong-cotto-lanh-ct1162a-1-duong-nuoc-10697.html',
      // Củ sen tắm
      'https://hita.com.vn/cu-sen-tam-cotto-gan-tuong-lanh-ct1184a-10703.html',
      'https://hita.com.vn/cu-sen-tam-nong-lanh-cotto-ct2161a-10737.html',
      // Tay sen tắm
      'https://hita.com.vn/tay-sen-tam-cotto-3-chuc-nang-s41-hm-10821.html',
      // Thanh tay vịn (phụ kiện phòng tắm)
      'https://hita.com.vn/thanh-tay-vin-cotto-ct0170-cr-10223.html',
      // Thanh treo khăn
      'https://hita.com.vn/thanh-treo-khan-cotto-c812-10870.html',
      // Lõ giấy vệ sinh
      'https://hita.com.vn/lo-giay-ve-sinh-cotto-c814-10898.html',
      // Vòi lavabo lạnh
      'https://hita.com.vn/voi-lavabo-lanh-cotto-ct167d-hm-10528.html',
      // extra: bon cau 2 khoi variant
      'https://hita.com.vn/bon-cau-2-khoi-cotto-xa-khong-cham-c135137-10164.html',
      // chau rua lavabo treo
      'https://hita.com.vn/chau-rua-lavabo-cotto-dat-ban-c001057-10351.html',
      // cu sen gan tuong variant
      'https://hita.com.vn/cu-sen-tam-cotto-gan-tuong-lanh-ct1184a-10703.html',
    ],
  },

  grohe: {
    slug: 'grohe',
    brandPageUrl: 'https://hita.com.vn/grohe.html',
    sitemapKeyword: 'grohe',
    excludeKeywords: ['hansgrohe'],
    sampleUrls: [
      // Vòi chậu nóng lạnh
      'https://hita.com.vn/voi-chau-nong-lanh-eurosmart-cosmo-m-size-grohe-23325000-8084.html',
      'https://hita.com.vn/voi-chau-gan-tuong-nong-lanh-2-lo-allure-grohe-19309000-16197.html',
      // Củ sen tắm
      'https://hita.com.vn/cu-sen-tam-nong-lanh-2-che-do-bauloop-grohe-23603000-8128.html',
      // Bộ sen cây
      'https://hita.com.vn/bo-sen-cay-tam-on-nhiet-euphoria-grohe-27964000-12986.html',
      // Bộ bát sen tắm gắn trần
      'https://hita.com.vn/bo-bat-sen-tam-gan-tran-tempesta-250-grohe-26664000-16358.html',
      // Bộ tay sen và thanh trượt
      'https://hita.com.vn/bo-tay-sen-va-thanh-truot-600mm-euphoria-110-massage-grohe-27231001-8141.html',
      'https://hita.com.vn/bo-thanh-truot-tay-sen-tam-3-che-do-rainshower-smartactive-130-grohe-26548000-16394.html',
      // Bảt sen
      'https://hita.com.vn/bat-sen-tam-rainshower-f-series-10-grohe-27271000-16373.html',
      // Van nhiệt độ
      'https://hita.com.vn/van-nhiet-do-kem-chuyen-huong-2-duong-grohtherm-cube-grohe-24154000-16441.html',
      'https://hita.com.vn/van-nong-lanh-kem-chuyen-huong-2-duong-grandera-grohe-24067000-16455.html',
      // Van điều chỉnh
      'https://hita.com.vn/van-dieu-chinh-nong-lanh-am-tuong-grandera-grohe-19934000-16453.html',
      // Vòi bếp
      'https://hita.com.vn/voi-bep-day-rut-nong-lanh-minta-grohe-32168000-8175.html',
      'https://hita.com.vn/voi-bep-nong-lanh-eurostyle-cosmopolitan-grohe-33977002-8178.html',
      // Chậu rửa mặt lavabo
      'https://hita.com.vn/chau-rua-mat-lavabo-treo-tuong-eurocube-grohe-39231000-13013.html',
      // Lõ giấy vệ sinh
      'https://hita.com.vn/lo-giay-ve-sinh-co-nap-essentials-grohe-40367001-8162.html',
      // Sen cây nhiệt độ
      'https://hita.com.vn/bo-cay-sen-tam-on-nhiet-euphoria-grohe-27296002-12978.html',
    ],
  },

  kanly: {
    slug: 'kanly',
    brandPageUrl: 'https://hita.com.vn/kanly.html',
    sitemapKeyword: 'kanly',
    sampleUrls: [
      'https://hita.com.vn/ban-dat-chau-lavabo-mat-da-kanly-fp07-11722.html',
      'https://hita.com.vn/ban-de-chau-rua-lavabo-kanly-mat-da-nhan-tao-fp12-5609.html',
      'https://hita.com.vn/ban-de-lavabo-mat-da-tu-nhien-kanly-fw03-6334.html',
      'https://hita.com.vn/bat-sen-bang-dong-kanly-gck93-11750.html',
      'https://hita.com.vn/bat-sen-bang-dong-kanly-gck95-6337.html',
      'https://hita.com.vn/bat-sen-tam-co-dien-bang-dong-kanly-gck91-6332.html',
      'https://hita.com.vn/bat-sen-tron-bang-dong-kanly-gck94-6333.html',
      'https://hita.com.vn/bat-sen-tron-bang-dong-kanly-gck94b-23510.html',
      'https://hita.com.vn/bat-sen-tron-bang-dong-kanly-gck95b-23509.html',
      'https://hita.com.vn/bat-sen-vuong-bang-dong-kanly-gck92-6335.html',
      'https://hita.com.vn/bat-sen-vuong-bang-dong-kanly-gck92b-23512.html',
      'https://hita.com.vn/binh-dung-dung-dich-kanly-gck44b17-11777.html',
      'https://hita.com.vn/binh-dung-dung-dich-kanly-pk08-11770.html',
      'https://hita.com.vn/binh-dung-nuoc-rua-tay-gan-tuong-kanly-binhdung-xaphong-19965.html',
      'https://hita.com.vn/binh-dung-nuoc-rua-tay-kanly-pk01b-23513.html',
      'https://hita.com.vn/binh-dung-nuoc-rua-tay-kanly-pk02b-23515.html',
      'https://hita.com.vn/binh-dung-nuoc-rua-tay-kanly-pk03b-23514.html',
      'https://hita.com.vn/binh-dung-nuoc-rua-tay-kanly-pk04b-23511.html',
      'https://hita.com.vn/binh-dung-nuoc-rua-tay-kanly-pk10b-23516.html',
      'https://hita.com.vn/bo-chau-lavabo-kanly-treo-tuong-bang-dong-dl2911b-23519.html',
    ],
  },

  esslinger: {
    slug: 'esslinger',
    brandPageUrl: 'https://hita.com.vn/esslinger.html',
    sitemapKeyword: 'esslinger',
    sampleUrls: [
      'https://hita.com.vn/voi-xit-ve-sinh-esslinger-es-1085a-12460.html',
      'https://hita.com.vn/voi-xit-ve-sinh-esslinger-es-9836a-12461.html',
      'https://hita.com.vn/thanh-treo-khan-esslinger-es-bh1101-12483.html',
      'https://hita.com.vn/thanh-treo-khan-esslinger-es-bh1103-12486.html',
      'https://hita.com.vn/ke-goc-esslinger-es-811211-12504.html',
      'https://hita.com.vn/sen-cay-tam-dung-esslinger-es-00202a-12350.html',
      'https://hita.com.vn/cu-sen-tam-esslinger.html',
      'https://hita.com.vn/voi-xit-ve-sinh-esslinger.html',
      'https://hita.com.vn/phu-kien-nha-tam-esslinger.html',
      'https://hita.com.vn/phu-kien-sen-voi-esslinger.html',
    ],
  },

  hansgrohe: {
    slug: 'hansgrohe',
    brandPageUrl: 'https://hita.com.vn/hansgrohe.html',
    sitemapKeyword: 'hansgrohe',
    sampleUrls: [
      'https://hita.com.vn/cu-sen-tam-nong-lanh-talis-s-hansgrohe-72400000-15611.html',
      'https://hita.com.vn/cu-sen-tam-nong-lanh-hg-rebris-s-hansgrohe-72440007-14649.html',
      'https://hita.com.vn/cu-sen-tam-nong-lanh-logis-hansgrohe-71400000-15607.html',
      'https://hita.com.vn/cu-sen-tam-nong-lanh-croma-220-hansgrohe-27223000-15615.html',
      'https://hita.com.vn/cu-sen-tam-nong-lanh-hg-crometta-s-240-1jet-eco-hansgrohe-26186000-14645.html',
      'https://hita.com.vn/sen-cay-nhiet-do-hg-crometta-s-240-1jet-eco-hansgrohe-26186000-14645.html',
      'https://hita.com.vn/sen-cay-nhiet-do-hg-vernis-shape-26286007-14647.html',
      'https://hita.com.vn/van-dieu-chinh-hansgrohe-cao-cap-cho-sen-tam.html',
      'https://hita.com.vn/voi-xa-bon-am-tuong-hg-logis-hansgrohe-71410000-14672.html',
      'https://hita.com.vn/bo-voi-chau-lavabo-am-tuong-2-lo-hg-vernis-blend-hansgrohe-71555007-14617.html',
    ],
  },

  panasonic: {
    slug: 'panasonic',
    brandPageUrl: 'https://hita.com.vn/thiet-bi-dien-panasonic.html',
    sitemapKeyword: 'panasonic',
    sampleUrls: [
      'https://hita.com.vn/may-nuoc-nong-truc-tiep-panasonic-4-5kw-dh-4ms1vw-5240.html',
      'https://hita.com.vn/may-loc-khong-khi-panasonic-f-pxj30a-5242.html',
      'https://hita.com.vn/may-loc-khong-khi-panasonic-f-p15eha-5243.html',
      'https://hita.com.vn/may-loc-khong-khi-danh-cho-o-to-panasonic-f-gpt01a-5244.html',
      'https://hita.com.vn/may-nuoc-nong-gian-tiep-panasonic-dh-15hbmvw-5295.html',
      'https://hita.com.vn/may-nuoc-nong-truc-tiep-panasonic-4-5kw-dh-4mp1vw-5301.html',
      'https://hita.com.vn/den-led-am-tran-panasonic-downlight-neo-slim-vuong-nnp72250-5336.html',
      'https://hita.com.vn/den-led-am-tran-panasonic-downlight-dn-2g-5353.html',
      'https://hita.com.vn/den-led-am-tran-panasonic-downlight-ez-series-sieu-mong-5357.html',
      'https://hita.com.vn/den-led-op-tran-panasonic-downlight-noi-khong-vien-rimless-tron-5371.html',
      'https://hita.com.vn/den-led-op-tran-panasonic-downlight-noi-khong-vien-rimless-vuong-5375.html',
      'https://hita.com.vn/den-tran-led-trang-tri-panasonic-co-cam-bien-5427.html',
      'https://hita.com.vn/den-gan-tuong-led-trang-tri-panasonic-bq1004w88-5454.html',
      'https://hita.com.vn/den-gan-tuong-led-trang-tri-panasonic-hh-bq1005w88-5455.html',
      'https://hita.com.vn/den-led-day-panasonic-ngoai-troi-nfv80003ce1a-5463.html',
      'https://hita.com.vn/driver-cho-den-led-day-panasonic-5464.html',
      'https://hita.com.vn/den-ban-led-panasonic-hh-lt0421-5465.html',
      'https://hita.com.vn/den-ban-led-panasonic-hh-lt0623-5467.html',
      'https://hita.com.vn/den-ban-led-panasonic-hh-lt062919-trang-den-co-the-thay-doi-chieu-cao-5471.html',
      'https://hita.com.vn/den-led-panasonic.html',
    ],
  },

  viglacera: {
    slug: 'viglacera',
    brandPageUrl: 'https://hita.com.vn/viglacera-597.html',
    sitemapKeyword: 'viglacera',
    sampleUrls: [
      // Lavabo âm bàn
      'https://hita.com.vn/chau-lavabo-am-ban-da-2-tang-viglacera-17026.html',
      // Lavabo đặt bàn
      'https://hita.com.vn/chau-rua-lavabo-dat-ban-viglacera-bs415-7201.html',
      'https://hita.com.vn/chau-rua-mat-lavabo-dat-ban-viglacera-platinum-p-23-321-14564.html',
      // Lavabo treo tường
      'https://hita.com.vn/chau-rua-lavabo-treo-tuong-viglacera-vtl2-7199.html',
      // Bồn cầu 1 khối
      'https://hita.com.vn/bon-cau-1-khoi-viglacera-bl5-5335.html',
      // Bồn cầu 2 khối
      'https://hita.com.vn/bon-cau-2-khoi-viglacera-vi107-7144.html',
      // Vòi chậu nóng lạnh
      'https://hita.com.vn/voi-chau-nong-lanh-viglacera-vg141-7180.html',
      'https://hita.com.vn/voi-chau-lavabo-nong-lanh-viglacera-platinum-p-52-356-14579.html',
      // Sen cây nóng lạnh
      'https://hita.com.vn/sen-cay-nong-lanh-viglacera-vg581-7263.html',
      // Sen tắm
      'https://hita.com.vn/sen-tam-nong-lanh-viglacera-vg511-7273.html',
      // Chân chậu lưng
      'https://hita.com.vn/chan-chau-lung-viglacera-bs502-7177.html',
      // Ga thoát sàn
      'https://hita.com.vn/ga-thoat-san-mat-vuong-ho-viglacera-vd-10-12-15-22478.html',
      // Fill remaining with top categories
      'https://hita.com.vn/chau-lavabo-am-ban-da-2-tang-viglacera-17026.html',
      'https://hita.com.vn/chau-rua-lavabo-dat-ban-viglacera-bs415-7201.html',
      'https://hita.com.vn/bon-cau-1-khoi-viglacera-bl5-5335.html',
      'https://hita.com.vn/voi-chau-nong-lanh-viglacera-vg141-7180.html',
      'https://hita.com.vn/sen-cay-nong-lanh-viglacera-vg581-7263.html',
      'https://hita.com.vn/bon-cau-2-khoi-viglacera-vi107-7144.html',
      'https://hita.com.vn/chau-rua-lavabo-treo-tuong-viglacera-vtl2-7199.html',
      'https://hita.com.vn/sen-tam-nong-lanh-viglacera-vg511-7273.html',
    ],
  },

  atmor: {
    slug: 'atmor',
    brandPageUrl: 'https://hita.com.vn/atmor.html',
    sitemapKeyword: 'atmor',
    sampleUrls: [
      // Bồn cầu 1 khối
      'https://hita.com.vn/bon-cau-1-khoi-nap-em-xa-nhan-atmor-at1084s-8942.html',
      // Lavabo đặt bàn
      'https://hita.com.vn/chau-rua-lavabo-dat-ban-atmor-at257-8969.html',
      // Lavabo treo tường
      'https://hita.com.vn/chau-rua-lavabo-treo-tuong-atmor-at1001-8988.html',
      // Vòi chậu nóng lạnh
      'https://hita.com.vn/voi-chau-nong-lanh-basic-atmor-at21123-9048.html',
      // Vòi lavabo cảm ứng
      'https://hita.com.vn/voi-chau-lavabo-cam-ung-atmor-at-0041-ac-at-1041-dc-9068.html',
      // Vòi rửa chén nóng lạnh âm tường
      'https://hita.com.vn/voi-rua-chen-nong-lanh-am-tuong-atmor-at20176-9314.html',
      // Vòi xịt vệ sinh
      'https://hita.com.vn/voi-xit-ve-sinh-atmor-at10010-9261.html',
      // Hộp nhấn xà phòng
      'https://hita.com.vn/hop-nhan-xa-phong-doi-500mlx2-atmor-dh-700-2w-9225.html',
      // Hộp giấy vệ sinh
      'https://hita.com.vn/hop-giay-ve-sinh-den-atmor-at1008b-9178.html',
      // Trục giấy vệ sinh
      'https://hita.com.vn/truc-giay-ve-sinh-inox-304-atmor-3190-9180.html',
      // Gương sời phòng tắm
      'https://hita.com.vn/guong-soi-phong-tam-doc-atmor-745-9244.html',
      // Fill to 20
      'https://hita.com.vn/bon-cau-1-khoi-nap-em-xa-nhan-atmor-at1084s-8942.html',
      'https://hita.com.vn/chau-rua-lavabo-dat-ban-atmor-at257-8969.html',
      'https://hita.com.vn/voi-chau-nong-lanh-basic-atmor-at21123-9048.html',
      'https://hita.com.vn/hop-nhan-xa-phong-doi-500mlx2-atmor-dh-700-2w-9225.html',
      'https://hita.com.vn/hop-giay-ve-sinh-den-atmor-at1008b-9178.html',
      'https://hita.com.vn/truc-giay-ve-sinh-inox-304-atmor-3190-9180.html',
      'https://hita.com.vn/chau-rua-lavabo-treo-tuong-atmor-at1001-8988.html',
      'https://hita.com.vn/voi-xit-ve-sinh-atmor-at10010-9261.html',
      'https://hita.com.vn/guong-soi-phong-tam-doc-atmor-745-9244.html',
    ],
  },

  moen: {
    slug: 'moen',
    brandPageUrl: 'https://hita.com.vn/moen.html',
    sitemapKeyword: 'moen',
    sampleUrls: [
      // Vòi lavabo nóng lạnh
      'https://hita.com.vn/voi-lavabo-nong-lanh-moen-duna-series-5440-9801.html',
      'https://hita.com.vn/bo-voi-lavabo-nong-lanh-moen-eva-6400-9803.html',
      // Bộ sen tắm
      'https://hita.com.vn/bo-sen-tam-nong-lanh-moen-90-degree-2271-9930.html',
      'https://hita.com.vn/bo-sen-cay-tam-nhiet-do-moen-m22032-2255-57332-9918.html',
      // Bộ vòi sen âm tường
      'https://hita.com.vn/bo-voi-sen-tam-am-tuong-moen-2599-9861.html',
      'https://hita.com.vn/cu-voi-am-tuong-nong-lanh-moen-kingsley-t3111-9900.html',
      // Bộ vòi bồn tắm nam
      'https://hita.com.vn/bo-voi-bon-tam-nam-nong-lanh-4-lo-moen-90-degree-ts904-9850.html',
      // Đầu sen trộn
      'https://hita.com.vn/dau-sen-tron-moen-3012-9862.html',
      // Bộ dây tay sen
      'https://hita.com.vn/bo-day-tay-sen-tam-moen-29898-9968.html',
      // Vòi rửa chén
      'https://hita.com.vn/voi-rua-chen-moen-5923-10127.html',
      // Phụ kiện phòng tắm
      'https://hita.com.vn/truc-giay-ve-sinh-moen-eva-yb2808ch-yb2808orb-9832.html',
      'https://hita.com.vn/vong-treo-khan-moen-kingsley-yb5486ch-yb5486orb-9831.html',
      // Fill to 20
      'https://hita.com.vn/voi-lavabo-nong-lanh-moen-duna-series-5440-9801.html',
      'https://hita.com.vn/bo-sen-tam-nong-lanh-moen-90-degree-2271-9930.html',
      'https://hita.com.vn/bo-voi-sen-tam-am-tuong-moen-2599-9861.html',
      'https://hita.com.vn/bo-sen-cay-tam-nhiet-do-moen-m22032-2255-57332-9918.html',
      'https://hita.com.vn/voi-rua-chen-moen-5923-10127.html',
      'https://hita.com.vn/truc-giay-ve-sinh-moen-eva-yb2808ch-yb2808orb-9832.html',
      'https://hita.com.vn/bo-voi-lavabo-nong-lanh-moen-eva-6400-9803.html',
      'https://hita.com.vn/bo-day-tay-sen-tam-moen-29898-9968.html',
    ],
  },

  // Existing brands — used for retroactive Phase 5 upsell only
  inax: {
    slug: 'inax',
    brandPageUrl: 'https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html',
    sitemapKeyword: 'inax',
    sampleUrls: [], // already fully crawled
  },

  toto: {
    slug: 'toto',
    brandPageUrl: 'https://hita.com.vn/thuong-hieu-thiet-bi-ve-sinh-toto.html',
    sitemapKeyword: 'toto',
    sampleUrls: [], // already fully crawled
  },
};

/**
 * Get brand config or throw if not found.
 * @param {string} brandSlug
 * @returns {typeof BRAND_CONFIGS[string]}
 */
export function getBrandConfig(brandSlug) {
  const config = BRAND_CONFIGS[brandSlug];
  if (!config) {
    const valid = Object.keys(BRAND_CONFIGS).join(', ');
    throw new Error(
      `Unknown brand: "${brandSlug}". Valid brands: ${valid}`
    );
  }
  return config;
}

/**
 * Parse --brand=<slug> from process.argv.
 * Exits with a helpful message if missing or invalid.
 * @returns {string} brand slug
 */
export function parseBrandArg() {
  const arg = process.argv.find(a => a.startsWith('--brand='));
  if (!arg) {
    console.error('❌ Missing required argument: --brand=<slug>');
    console.error(`   Valid brands: ${Object.keys(BRAND_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  const slug = arg.split('=')[1];
  return getBrandConfig(slug) && slug; // validates + returns slug
}
