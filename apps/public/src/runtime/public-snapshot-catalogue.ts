import { cache } from 'react'
import { usesPublicSnapshot, publicSnapshotCheckpoint } from './public-snapshot-mode'
import { buildSnapshotCategoryRoot } from './public-category-root'
import {
  isPublicSnapshotListingProduct,
  PUBLIC_SNAPSHOT_LISTING_CONTRACT,
  PUBLIC_SNAPSHOT_LISTING_MAX_PAGES,
  PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
  type PublicSnapshotListingShard,
} from './snapshot-listing-contract'
export { usesPublicSnapshot } from './public-snapshot-mode'

const CONTRACT='dpg:public-catalogue-snapshot:v1'
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const PUBLIC_SNAPSHOT_NOTICE='Catalogue khôi phục ở chế độ chỉ đọc. Giá và tồn kho cần được xác nhận; vui lòng liên hệ Đông Phú Gia để nhận báo giá hiện tại.'
export type SnapshotProduct={
  id:number;name:string;display_name:string;slug:string;sku:string;price:null;price_display:string;stock_status:'contact';
  image_main_url:string|null;is_active:true;is_featured:boolean;is_promotion:false;variant_options:[];
  categories:{name:string;slug:string};subcategories:{name:string;slug:string};brands:{name:string;slug:string}|null;
  publicContent?:{summary:string|null;specifications:Record<string,string>;gallery:string[]};
  canonical_category_slug:string;canonical_subcategory_slug:string;url:string;
}
type SnapshotListing={slug:string;name:string;thumbnail_url?:string|null;totalCount:number}
type SnapshotBrand={slug:string;name:string}
export type SnapshotCategory={slug:string;name:string;listings:SnapshotListing[];homeProducts:SnapshotProduct[];totalCount:number;brands?:SnapshotBrand[];featuredProducts?:SnapshotProduct[];featuredProductsByBrand?:SnapshotProduct[]}
type Manifest={contract:string;checkpoint:string;m3CodeSha:string;m3RunId:string;notice:string;categories:SnapshotCategory[];productBuckets:string[];products:number;listingProducts:number}
type AssetEnvelope={contract:string;checkpoint:string;products?:SnapshotProduct[];totalCount?:number;page?:number}

async function readAsset<T>(path:string):Promise<T> {
  if(!usesPublicSnapshot()||process.env.APP_ENV!=='preview'||process.env.PREVIEW_NOINDEX!=='true'
    ||!publicSnapshotCheckpoint()) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const {env}=await import('cloudflare:workers')
  const assets=(env as {ASSETS?:{fetch:(url:string)=>Promise<Response>}}).ASSETS
  if(!assets) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const response=await assets.fetch('https://catalogue-assets.invalid/__catalogue/v1/'+path)
  if(!response.ok) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const body=await response.text()
  if(body.length>2000000) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  let value
  try { value=JSON.parse(body) } catch { throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE') }
  if(value.contract!==CONTRACT||value.checkpoint!==publicSnapshotCheckpoint()) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  // Exact documented Bunny pull-zone alias; preserve path, never credentials/query.
  const repair = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(x=>typeof x==='string'&&x.startsWith('https://cdn.dongphugia.com.vn/')?x.replace('https://cdn.dongphugia.com.vn/','https://dpg-products.b-cdn.net/'):repair(x))
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,(k==='image_main_url'||k==='thumbnail_url'||k==='gallery')&&typeof x==='string'&&x.startsWith('https://cdn.dongphugia.com.vn/')?x.replace('https://cdn.dongphugia.com.vn/','https://dpg-products.b-cdn.net/'):repair(x)]))
    return v
  }
  return repair(value) as T
}
export const readSnapshotManifest=cache(async()=>readAsset<Manifest>('manifest.json'))
export async function getSnapshotCategories() { return (await readSnapshotManifest()).categories }
export async function getSnapshotCategoryRoot(categorySlug:string,brandSlugs:readonly string[]=[]){
  if(!SLUG.test(categorySlug)||brandSlugs.some(brandSlug=>!SLUG.test(brandSlug)))return null
  const category=(await getSnapshotCategories()).find(c=>c.slug===categorySlug)
  return category?buildSnapshotCategoryRoot(category,brandSlugs):null
}
export async function getSnapshotProducts(category:string,listing:string,page=1) {
  if(!SLUG.test(category)||!SLUG.test(listing)||!Number.isSafeInteger(page)||page<1) return {products:[],totalCount:0,page}
  const categoryRecord=(await getSnapshotCategories()).find(c=>c.slug===category)
  const list=categoryRecord?.listings.find(l=>l.slug===listing)
  if(!list||page>Math.ceil(list.totalCount/PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)) return {products:[],totalCount:list?.totalCount??0,page}
  if(!Number.isSafeInteger(list.totalCount)||list.totalCount<1
    ||Math.ceil(list.totalCount/PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)>PUBLIC_SNAPSHOT_LISTING_MAX_PAGES)
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const result=await readAsset<AssetEnvelope>(`listings/${category}/${listing}/${page}.json`)
  const expectedProducts=Math.min(PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,list.totalCount-(page-1)*PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)
  if(!Array.isArray(result.products)||result.page!==page||result.totalCount!==list.totalCount
    ||result.products.length!==expectedProducts)
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  return {products:result.products,totalCount:list.totalCount,page}
}

export async function getPublicSnapshotListingShard(category:string,listing:string,page=1):Promise<PublicSnapshotListingShard|null> {
  if(!SLUG.test(category)||!SLUG.test(listing)||!Number.isSafeInteger(page)||page<1)return null
  const manifest=await readSnapshotManifest()
  const categoryRecord=manifest.categories.find(value=>value.slug===category)
  if(!categoryRecord)return null
  const listingRecord=categoryRecord.listings.find(value=>value.slug===listing)
  if(!listingRecord)return null
  if(!Number.isSafeInteger(listingRecord.totalCount)||listingRecord.totalCount<1
    ||Math.ceil(listingRecord.totalCount/PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)>PUBLIC_SNAPSHOT_LISTING_MAX_PAGES)
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const totalPages=Math.ceil(listingRecord.totalCount/PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)
  if(page>totalPages)return null
  const shard=await getSnapshotProducts(category,listing,page)
  if(shard.totalCount!==listingRecord.totalCount||shard.page!==page||shard.products.length===0
    ||shard.products.some(product=>!isPublicSnapshotListingProduct(product,category,listing)))
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const products=shard.products.map(product=>({
    id:product.id,name:product.name,display_name:product.display_name,slug:product.slug,sku:product.sku,
    price:null as const,price_display:'Liên hệ báo giá' as const,stock_status:'contact' as const,
    image_main_url:product.image_main_url,is_active:true as const,is_featured:product.is_featured,
    is_promotion:false as const,variant_options:[] as [],categories:product.categories,
    subcategories:product.subcategories,brands:product.brands,
    canonical_category_slug:product.canonical_category_slug,
    canonical_subcategory_slug:product.canonical_subcategory_slug,url:product.url,
  }))
  const response:PublicSnapshotListingShard={
    contract:PUBLIC_SNAPSHOT_LISTING_CONTRACT,checkpoint:publicSnapshotCheckpoint()!,
    categorySlug:category,listingSlug:listing,page,pageSize:PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    totalCount:listingRecord.totalCount,totalPages,products,
  }
  return response
}
export async function getSnapshotProduct(category:string,listing:string,slug:string) {
  if(![category,listing,slug].every(s=>SLUG.test(s))) return null
  const path=`/${category}/${listing}/${slug}`
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path)))
  const bucket=hash[0].toString(16).padStart(2,'0')
  const manifest=await readSnapshotManifest()
  if(!manifest.productBuckets.includes(bucket)) return null
  const result=await readAsset<AssetEnvelope>(`products/${bucket}.json`)
  const product=result.products?.find(p=>p.url===path)
  if(!product) return null
  return {...product,imageUrl:product.image_main_url,brand:product.brands??{name:'',slug:''},
    categoryName:product.categories.name,listingName:product.subcategories.name,
    categoryPath:`/${category}`,listingPath:`/${category}/${listing}`,productPath:path,priceDisplay:'Liên hệ báo giá'}
}
export async function resolveSnapshotRoute(segments:readonly string[]) {
  if(!segments.length)return {kind:'home' as const}
  if(segments.length>3||segments.some(s=>!SLUG.test(s)))return {kind:'not-found' as const}
  if(segments.length===3) {
    const product=await getSnapshotProduct(segments[0],segments[1],segments[2])
    return product?{kind:'product' as const,product,category:{slug:segments[0],name:product.categoryName},listing:{slug:segments[1],name:product.listingName}}:{kind:'not-found' as const}
  }
  const category=(await getSnapshotCategories()).find(c=>c.slug===segments[0])
  if(!category)return {kind:'not-found' as const}
  if(segments.length===1)return {kind:'category' as const,category}
  const listing=category.listings.find(l=>l.slug===segments[1])
  return listing?{kind:'listing' as const,category,listing}:{kind:'not-found' as const}
}
