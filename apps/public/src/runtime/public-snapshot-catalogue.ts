import { cache } from 'react'
import { usesPublicSnapshot, publicSnapshotCheckpoint } from './public-snapshot-mode'
import { buildSnapshotCategoryRoot } from './public-category-root'
import { readBoundedPublicAssetText } from './bounded-public-asset'
import {
  PUBLIC_SNAPSHOT_LISTING_MAX_PAGES,
  PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
} from './snapshot-listing-contract'
import { selectSnapshotVariantData } from './variant-selection-contract'
import type {SnapshotVariantAxis,SnapshotVariantOption} from './variant-selection-contract'
export { usesPublicSnapshot } from './public-snapshot-mode'
export type {SnapshotVariantAxis,SnapshotVariantOption} from './variant-selection-contract'

const CONTRACT='dpg:public-catalogue-snapshot:v1'
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const PUBLIC_SNAPSHOT_NOTICE='Giá hiển thị theo dữ liệu công khai đã khôi phục. Vui lòng liên hệ Đông Phú Gia để xác nhận giá và tồn kho hiện tại.'
export type SnapshotProduct={
  id:number;name:string;display_name:string;slug:string;sku:string;price:number|null;price_display:string|null;stock_status:'contact';
  original_price?:number|null;list_price?:number|null;sale_price?:number|null;online_discount_amount?:number|null;final_online_price?:number|null;price_provenance?:string|null;
  image_main_url:string|null;is_active:true;is_featured:boolean;is_promotion:boolean;variant_options:SnapshotVariantOption[];
  product_feature_values?:{product_features:{name:string}}[];colors?:{name:string;hex_code:string|null}|null;
  categories:{name:string;slug:string};subcategories:{name:string;slug:string};brands:{name:string;slug:string}|null;
  publicContent?:{summary:string|null;descriptionBlocks:{kind:'heading'|'paragraph'|'bullet';text:string}[];specifications:Record<string,string>;gallery:string[];referencePrice:{amountVnd:number;recordedUpdateDate:'2026-07-02';provenance:'legacy-manual-public-display'}|null;descriptionHtml?:string|null;documents?:{name:string;url:string;type:string;size?:string}[]};
  canonical_category_slug:string;canonical_subcategory_slug:string;url:string;
  variant_group?:string;variant_type?:'size'|'seat_type';variant_label?:string;
}
type SnapshotListing={slug:string;name:string;thumbnail_url?:string|null;totalCount:number}
type SnapshotBrand={slug:string;name:string}
export type SnapshotCategory={slug:string;name:string;listings:SnapshotListing[];homeProducts:SnapshotProduct[];totalCount:number;brands?:SnapshotBrand[];featuredProducts?:SnapshotProduct[];featuredProductsByBrand?:SnapshotProduct[]}
type Manifest={contract:string;checkpoint:string;m3CodeSha:string;m3RunId:string;notice:string;categories:SnapshotCategory[];productBuckets:string[];products:number;listingProducts:number;variantGroups?:Record<string,SnapshotProduct[]>;variantAxes?:Record<string,SnapshotVariantAxis[]>;searchShards?:string[];searchProducts?:number}
type AssetEnvelope={contract:string;checkpoint:string;products?:SnapshotProduct[];totalCount?:number;page?:number}

async function readAsset<T>(path:string):Promise<T> {
  if(!usesPublicSnapshot()||!(['preview','production'].includes(process.env.APP_ENV??''))
    ||(process.env.APP_ENV==='preview'&&process.env.PREVIEW_NOINDEX!=='true')
    ||(process.env.APP_ENV==='production'&&process.env.PREVIEW_NOINDEX==='true')
    ||!publicSnapshotCheckpoint()) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const {env}=await import('cloudflare:workers')
  const assets=(env as {ASSETS?:{fetch:(url:string)=>Promise<Response>}}).ASSETS
  if(!assets) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const response=await assets.fetch('https://catalogue-assets.invalid/__catalogue/v1/'+path)
  if(!response.ok) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const body=await readBoundedPublicAssetText(response)
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
export type SnapshotSearchProduct={id:number;sku:string;name:string;slug:string;url:string;price:number|null;original_price:number|null;list_price:number|null;sale_price:number|null;online_discount_amount:number|null;final_online_price:number|null;price_display:string|null;image_main_url:string|null;category_slug:string;subcategory_slug:string;brand_name:string|null;product_feature_values:{product_features:{name:string}}[];colors:{name:string;hex_code:string|null}|null}
export async function getSnapshotSearchProducts(){
 const manifest=await readSnapshotManifest()
 if(!Array.isArray(manifest.searchShards)||manifest.searchShards.join(',')!=='0,1,2,3'
   ||!Number.isSafeInteger(manifest.searchProducts)||manifest.searchProducts===undefined
   ||manifest.searchProducts<0||manifest.searchProducts>manifest.products)throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
 const shards=await Promise.all(manifest.searchShards.map(id=>readAsset<{products:SnapshotSearchProduct[]}>(`search/${id}.json`)))
 const products=shards.flatMap(shard=>shard.products)
 if(products.length!==manifest.searchProducts||new Set(products.map(product=>product.id)).size!==products.length)throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
 return products
}
export async function getSnapshotVariantSiblings(group:string,currentId:number){
 return (await getSnapshotVariantSelectionData(group,currentId)).siblings
}
export async function getSnapshotVariantSelectionData(group:string,currentId:number){
 if(!/^public-[1-9][0-9]*$/.test(group)||!Number.isSafeInteger(currentId))
  return {axes:[] as SnapshotVariantAxis[],currentVariantOptions:[] as SnapshotVariantOption[],siblings:[] as SnapshotProduct[]}
 const manifest=await readSnapshotManifest()
 const members=manifest.variantGroups?.[group]
 const axes=manifest.variantAxes?.[group]
 return selectSnapshotVariantData<SnapshotProduct>(group,currentId,members,axes)
}
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
    categoryPath:`/${category}`,listingPath:`/${category}/${listing}`,productPath:path,priceDisplay:product.price_display??(product.price===null?'Liên hệ báo giá':null)}
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
