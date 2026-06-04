const fs = require('fs');

const atmorSkus = {
  'JXG-125': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay' },
  'JXG-130': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay' },
  'JXG-210N': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay' },
  'JXG-218': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'phu-kien-phong-tam', product_type: 'may-say-tay' },
  'AT-368E': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  'AT-378EP': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  'AT-378EP NEW': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  'AT-LOTUS': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  'AT-15E': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  'AT-30E': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  'AT-INLINE': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-truc-tiep' },
  'AT-150EV': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-gian-tiep' },
  'AT-50EH': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-gian-tiep' },
  'AT-50EHT': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-gian-tiep' },
  'AT-30H': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-gian-tiep' },
  'AT-50HR': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'may-nuoc-nong', product_type: 'may-nuoc-nong-gian-tiep' }
};

const atmorPath = 'output/atmor/crawled-products-with-cdn.json';
let atmorData = JSON.parse(fs.readFileSync(atmorPath, 'utf8'));
let atmorPatched = 0;
atmorData.forEach(p => {
  if (atmorSkus[p.sku]) {
    Object.assign(p, atmorSkus[p.sku]);
    atmorPatched++;
  }
});
fs.writeFileSync(atmorPath, JSON.stringify(atmorData, null, 2));
console.log(`Patched ${atmorPatched} ATMOR products.`);

const moenSkus = {
  'DN7075': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'phu-kien-phong-tam', product_type: 'thanh-tay-vin' },
  'DN7175': { category_id: 'thiet-bi-ve-sinh', subcategory_id: 'phu-kien-phong-tam', product_type: 'thanh-tay-vin' }
};

const moenPath = 'output/moen/crawled-products-with-cdn.json';
let moenData = JSON.parse(fs.readFileSync(moenPath, 'utf8'));
let moenPatched = 0;
moenData.forEach(p => {
  if (moenSkus[p.sku]) {
    Object.assign(p, moenSkus[p.sku]);
    moenPatched++;
  }
});
fs.writeFileSync(moenPath, JSON.stringify(moenData, null, 2));
console.log(`Patched ${moenPatched} MOEN products.`);
