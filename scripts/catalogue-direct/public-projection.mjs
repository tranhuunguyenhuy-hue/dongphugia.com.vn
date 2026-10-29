import {safeImage} from './public-image-policy.mjs'
export {safeImage} from './public-image-policy.mjs'
import {isSafePublicContent} from './public-product-content.mjs'
import { createHash } from 'node:crypto'

export const PROJECTION_CONTRACT = 'dpg:public-catalogue-snapshot:v1'
export const PAGE_SIZE = 48
export const NOTICE = 'Catalogue khôi phục ở chế độ chỉ đọc. Giá và tồn kho cần được xác nhận; vui lòng liên hệ Đông Phú Gia để nhận báo giá hiện tại.'
export const ROOTS = ['thiet-bi-ve-sinh', 'thiet-bi-bep', 'vat-lieu-nuoc', 'gach-op-lat']
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export function productBucket(path) { return createHash('sha256').update(path).digest('hex').slice(0, 2) }

// Caller supplies canonical public-visibility and taxonomy decisions from the
// existing domain functions. Never spread input/database rows into this DTO.
export function projectProduct(input, visibility, canonical) {
  if (!visibility.pdp || !ROOTS.includes(canonical.categorySlug) || canonical.taxonomyException
    || ![canonical.categorySlug, canonical.subcategorySlug, input.slug].every(s => SLUG.test(s))) return null
  const image = safeImage(input.image_main_url)
  const path = `/${canonical.categorySlug}/${canonical.subcategorySlug}/${input.slug}`
  return {
    id: input.id, name: input.display_name || input.name, display_name: input.display_name || input.name,
    slug: input.slug, sku: input.sku,
    // Deliberately omit all historic prices, promotions and availability claims.
    price: null, price_display: 'Liên hệ báo giá', stock_status: 'contact',
    image_main_url: image, is_active: true, is_featured: input.is_featured === true,
    is_promotion: false, variant_options: [],
    categories: { name: canonical.categoryName || canonical.categorySlug, slug: canonical.categorySlug },
    subcategories: { name: canonical.subcategoryName || canonical.subcategorySlug, slug: canonical.subcategorySlug },
    brands: input.brand_name && input.brand_slug ? {name: input.brand_name, slug: input.brand_slug} : null,
    canonical_category_slug: canonical.categorySlug, canonical_subcategory_slug: canonical.subcategorySlug,
    url: path, listingEligible: visibility.listing,
    rootSortOrder: Number.isSafeInteger(input.rootSortOrder) ? input.rootSortOrder : 0,
    rootBrandId: Number.isSafeInteger(input.rootBrandId) ? input.rootBrandId : null,
    rootBrandSortOrder: Number.isSafeInteger(input.rootBrandSortOrder) ? input.rootBrandSortOrder : null,
    rootSubcategorySortOrder: Number.isSafeInteger(input.rootSubcategorySortOrder) ? input.rootSubcategorySortOrder : null,
    rootSubcategoryThumbnailUrl: safeImage(input.rootSubcategoryThumbnailUrl),
  }
}

export function buildProjection(products, evidence, rootMetadata = []) {
  if (!/^[a-f0-9]{40}$/.test(evidence.checkpoint) || !/^[a-f0-9]{40}$/.test(evidence.m3CodeSha)
    || !/^[0-9]+$/.test(evidence.m3RunId)) throw new Error('PUBLIC_PROJECTION_M3_EVIDENCE_REQUIRED')
  const paths = new Set()
  const categories = new Map()
  const buckets = new Map()
  const pages = new Map()
  const categoryBrands = new Map()
  const featuredCandidates = new Map()
  for (const root of rootMetadata) {
    if (!ROOTS.includes(root.slug) || !SLUG.test(root.slug) || categories.has(root.slug)) throw new Error('PUBLIC_PROJECTION_ROOT_METADATA_INVALID')
    const category = {slug:root.slug,name:root.name,listings:[],homeProducts:[],totalCount:0,brands:[],featuredProducts:[],featuredProductsByBrand:[]}
    const seenListings = new Set()
    for (const listing of root.listings ?? []) {
      if (!SLUG.test(listing.slug) || seenListings.has(listing.slug)) throw new Error('PUBLIC_PROJECTION_ROOT_LISTING_INVALID')
      seenListings.add(listing.slug)
      category.listings.push({slug:listing.slug,name:listing.name,thumbnail_url:safeImage(listing.thumbnailUrl),totalCount:0,rootSortOrder:listing.sortOrder})
    }
    categories.set(root.slug,category)
    categoryBrands.set(root.slug,new Map())
    featuredCandidates.set(root.slug,[])
  }
  for (const product of products) {
    const keys = ['id','name','display_name','slug','sku','price','price_display','stock_status','image_main_url','is_active','is_featured','is_promotion','variant_options','categories','subcategories','brands','canonical_category_slug','canonical_subcategory_slug','url','listingEligible','publicContent','rootSortOrder','rootBrandId','rootBrandSortOrder','rootSubcategorySortOrder','rootSubcategoryThumbnailUrl']
    if (Object.keys(product).some(key => !keys.includes(key)) || product.price !== null || product.stock_status !== 'contact') throw new Error('PUBLIC_PROJECTION_UNSAFE_DTO')
    if(product.publicContent&&!isSafePublicContent(product.publicContent))throw new Error('PUBLIC_PROJECTION_UNSAFE_CONTENT')
    if (paths.has(product.url)) throw new Error('PUBLIC_PROJECTION_DUPLICATE_CANONICAL_PATH')
    paths.add(product.url)
    // Eligibility is a server-side decision, not a public DTO property.
    const {
      listingEligible,
      publicContent,
      rootSortOrder,
      rootBrandId,
      rootBrandSortOrder,
      rootSubcategorySortOrder,
      rootSubcategoryThumbnailUrl,
      ...publicProduct
    } = product
    const bucket = productBucket(product.url)
    if (!buckets.has(bucket)) buckets.set(bucket, [])
    buckets.get(bucket).push(publicContent?{...publicProduct,publicContent}:publicProduct)
    if (!listingEligible) continue
    const categorySlug = product.categories.slug, listingSlug = product.subcategories.slug
    if (!categories.has(categorySlug)) categories.set(categorySlug, {slug:categorySlug,name:product.categories.name,listings:[],homeProducts:[],totalCount:0,brands:[],featuredProducts:[],featuredProductsByBrand:[]})
    const category = categories.get(categorySlug)
    if (!categoryBrands.has(categorySlug)) categoryBrands.set(categorySlug,new Map())
    if (!featuredCandidates.has(categorySlug)) featuredCandidates.set(categorySlug,[])
    category.totalCount++
    if (category.homeProducts.length < 8) category.homeProducts.push(publicProduct)
    if(product.brands&&SLUG.test(product.brands.slug)){
      const knownBrands=categoryBrands.get(categorySlug)
      if(!knownBrands.has(product.brands.slug)) knownBrands.set(product.brands.slug,{
        slug:product.brands.slug,name:product.brands.name,
        sortOrder:rootBrandSortOrder??Number.MAX_SAFE_INTEGER,
        id:rootBrandId??Number.MAX_SAFE_INTEGER,
      })
    }
    let listing = category.listings.find(l => l.slug === listingSlug)
    if (!listing) { listing={slug:listingSlug,name:product.subcategories.name,thumbnail_url:rootSubcategoryThumbnailUrl,totalCount:0,rootSortOrder:rootSubcategorySortOrder??Number.MAX_SAFE_INTEGER};category.listings.push(listing) }
    listing.totalCount++
    if(product.is_featured)featuredCandidates.get(categorySlug).push({product:publicProduct,brandSlug:product.brands?.slug??null,sortOrder:rootSortOrder??Number.MAX_SAFE_INTEGER})
    const key = `${categorySlug}/${listingSlug}`
    if (!pages.has(key)) pages.set(key, [])
    pages.get(key).push(publicProduct)
  }
  for (const [categorySlug,category] of categories) {
    const brands=[...(categoryBrands.get(categorySlug)??new Map()).values()]
      .sort((a,b)=>a.sortOrder-b.sortOrder||a.id-b.id||a.slug.localeCompare(b.slug))
      .slice(0,20)
    const allowedBrands=new Set(brands.map(brand=>brand.slug))
    const featured=(featuredCandidates.get(categorySlug)??[])
      .sort((a,b)=>a.sortOrder-b.sortOrder||a.product.id-b.product.id||a.product.url.localeCompare(b.product.url))
    category.brands=brands.map(({slug,name})=>({slug,name}))
    category.featuredProducts=featured.slice(0,8).map(entry=>entry.product)
    const perBrandCount=new Map()
    category.featuredProductsByBrand=[]
    for(const entry of featured){
      if(!entry.brandSlug||!allowedBrands.has(entry.brandSlug))continue
      const count=perBrandCount.get(entry.brandSlug)??0
      if(count>=8)continue
      category.featuredProductsByBrand.push(entry.product)
      perBrandCount.set(entry.brandSlug,count+1)
    }
    category.listings=category.listings
      .sort((a,b)=>a.rootSortOrder-b.rootSortOrder||a.name.localeCompare(b.name)||a.slug.localeCompare(b.slug))
      .map(({slug,name,thumbnail_url,totalCount})=>({slug,name,thumbnail_url,totalCount}))
  }
  const assets = new Map()
  const contentStats={summaries:products.filter(p=>p.publicContent?.summary).length,specifications:products.filter(p=>Object.keys(p.publicContent?.specifications??{}).length).length,galleries:products.filter(p=>p.publicContent?.gallery?.length).length}
  const manifest = { contentPolicy:'canonical-public-content-v1',contentStats,contract:PROJECTION_CONTRACT,...evidence,notice:NOTICE,productBuckets:[...buckets.keys()].sort(),categories:[...categories.values()],products:products.length,listingProducts:[...pages.values()].reduce((n,p)=>n+p.length,0) }
  assets.set('manifest.json', manifest)
  for (const [bucket, values] of buckets) assets.set(`products/${bucket}.json`,{contract:PROJECTION_CONTRACT,checkpoint:evidence.checkpoint,products:values})
  for (const [key, values] of pages) for(let offset=0;offset<values.length;offset+=PAGE_SIZE)
    assets.set(`listings/${key}/${offset/PAGE_SIZE+1}.json`,{contract:PROJECTION_CONTRACT,checkpoint:evidence.checkpoint,totalCount:values.length,page:offset/PAGE_SIZE+1,products:values.slice(offset,offset+PAGE_SIZE)})
  return { manifest, assets }
}
