import { cache } from 'react'
import { publicPostgresEnabled } from './public-db'
import { getLiveCategories,getLiveListing,getLiveProduct,getLiveVariantSiblings } from './live-public-catalogue'
import { usesPublicSnapshot, usesProductionPublishedCatalogue, publicSnapshotCheckpoint } from './public-snapshot-mode'
import { buildSnapshotCategoryRoot } from './public-category-root'
import { readBoundedPublicAssetText } from './bounded-public-asset'
import {
  PUBLIC_SNAPSHOT_LISTING_MAX_PAGES,
  PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
} from './snapshot-listing-contract'
export { usesPublicSnapshot } from './public-snapshot-mode'

const CONTRACT='dpg:public-catalogue-snapshot:v1'
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PRODUCTION_PUBLIC_ORIGIN='https://www.dongphugia.vn'
const CATEGORY_FAMILIES=new Set(['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat'])
const PUBLIC_CATALOGUE_ASSET=/^(?:manifest\.json|listings\/(?:thiet-bi-ve-sinh|thiet-bi-bep|vat-lieu-nuoc|gach-op-lat)\/[a-z0-9]+(?:-[a-z0-9]+)*\/[1-9][0-9]{0,3}\.json|products\/[a-f0-9]{2}\.json|search\/[0-3]\.json)$/
export const PUBLIC_SNAPSHOT_NOTICE='Dữ liệu sản phẩm và giá được đọc trực tiếp từ catalogue công khai mà Production hiện đang phục vụ (checkpoint đã xuất bản). Đây không phải bản đọc cơ sở dữ liệu trực tiếp; giá/tồn kho cần được xác nhận với Đông Phú Gia trước khi đặt hàng.'
export type SnapshotProduct={
  id:number;name:string;display_name:string;slug:string;sku:string;price:number|null;price_display:string|null;stock_status:'contact';
  original_price?:number|null;list_price?:number|null;sale_price?:number|null;online_discount_amount?:number|null;final_online_price?:number|null;price_provenance?:string|null;
  image_main_url:string|null;is_active:true;is_featured:boolean;is_promotion:boolean;variant_options:[];
  product_feature_values?:{product_features:{name:string}}[];colors?:{name:string;hex_code:string|null}|null;
  categories:{name:string;slug:string};subcategories:{name:string;slug:string};brands:{name:string;slug:string}|null;
  publicContent?:{summary:string|null;descriptionBlocks:{kind:'heading'|'paragraph'|'bullet';text:string}[];specifications:Record<string,string>;gallery:string[];referencePrice:{amountVnd:number;recordedUpdateDate:'2026-07-02';provenance:'legacy-manual-public-display'}|null;descriptionHtml?:string|null;documents?:{name:string;url:string;type:string;size?:string}[]};
  canonical_category_slug:string;canonical_subcategory_slug:string;url:string;
  variant_group?:string;variant_type?:'size'|'seat_type';variant_label?:string;
}
type SnapshotListing={slug:string;name:string;thumbnail_url?:string|null;totalCount:number}
type SnapshotBrand={slug:string;name:string}
export type SnapshotCategory={slug:string;name:string;listings:SnapshotListing[];homeProducts:SnapshotProduct[];totalCount:number;brands?:SnapshotBrand[];featuredProducts?:SnapshotProduct[];featuredProductsByBrand?:SnapshotProduct[]}
type Manifest={contract:string;checkpoint:string;m3CodeSha:string;m3RunId:string;notice:string;categories:SnapshotCategory[];productBuckets:string[];products:number;listingProducts:number;variantGroups?:Record<string,SnapshotProduct[]>;searchShards?:string[];searchProducts?:number}
type AssetEnvelope={contract:string;checkpoint:string;products?:SnapshotProduct[];totalCount?:number;page?:number}

async function readAsset<T>(path:string):Promise<T> {
  if(!usesPublicSnapshot()||!(['preview','staging','production'].includes(process.env.APP_ENV??''))
    ||(process.env.APP_ENV==='preview'&&process.env.PREVIEW_NOINDEX!=='true')
    ||(process.env.APP_ENV==='production'&&process.env.PREVIEW_NOINDEX==='true')
    ||(!usesProductionPublishedCatalogue()&&!publicSnapshotCheckpoint())) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  let response:Response
  let productionManifest:Manifest|undefined
  if(usesProductionPublishedCatalogue()) {
    if(path==='manifest.json') {
      response=await fetchProductionCatalogueAsset(path)
    } else {
      productionManifest=await readSnapshotManifest()
      assertProductionAssetDeclared(path,productionManifest)
      response=await fetchProductionCatalogueAsset(path,productionManifest)
    }
  } else {
    const {env}=await import('cloudflare:workers')
    const assets=(env as {ASSETS?:{fetch:(url:string)=>Promise<Response>}}).ASSETS
    if(!assets) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    response=await assets.fetch('https://catalogue-assets.invalid/__catalogue/v1/'+path)
    if(!response.ok) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  }
  const body=await readBoundedPublicAssetText(response)
  let value
  try { value=JSON.parse(body) } catch { throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE') }
  if(value.contract!==CONTRACT) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  if(usesProductionPublishedCatalogue()) {
    if(path==='manifest.json') validateProductionManifest(value)
    else if(value.checkpoint!==productionManifest?.checkpoint) throw new Error('PUBLIC_CATALOGUE_CHECKPOINT_MISMATCH')
  } else if(value.checkpoint!==publicSnapshotCheckpoint()) {
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  }
  // Exact documented Bunny pull-zone alias; preserve path, never credentials/query.
  const repair = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(x=>typeof x==='string'&&x.startsWith('https://cdn.dongphugia.com.vn/')?x.replace('https://cdn.dongphugia.com.vn/','https://dpg-products.b-cdn.net/'):repair(x))
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,(k==='image_main_url'||k==='thumbnail_url'||k==='gallery')&&typeof x==='string'&&x.startsWith('https://cdn.dongphugia.com.vn/')?x.replace('https://cdn.dongphugia.com.vn/','https://dpg-products.b-cdn.net/'):repair(x)]))
    return v
  }
  return repair(value) as T
}

function validateProductionManifest(value:unknown):asserts value is Manifest {
  if(!value||typeof value!=='object') throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  const manifest=value as Partial<Manifest>
  if(manifest.contract!==CONTRACT||! /^[a-f0-9]{40}$/.test(manifest.checkpoint??'')
    ||! /^[a-f0-9]{40}$/.test(manifest.m3CodeSha??'')
    ||typeof manifest.m3RunId!=='string'||manifest.m3RunId.length===0
    ||!Array.isArray(manifest.categories)||manifest.categories.length!==4
    ||!Array.isArray(manifest.productBuckets)||!manifest.productBuckets.every((bucket)=>typeof bucket==='string'&&/^[a-f0-9]{2}$/.test(bucket))
    ||manifest.productBuckets.length===0||manifest.productBuckets.length>256
    ||new Set(manifest.productBuckets).size!==manifest.productBuckets.length
    ||!Array.isArray(manifest.searchShards)||!manifest.searchShards.every((shard)=>typeof shard==='string'&&/^[0-3]$/.test(shard))
    ||manifest.searchShards.join(',')!=='0,1,2,3'
    ||typeof manifest.products!=='number'||!Number.isSafeInteger(manifest.products)||manifest.products<0
    ||typeof manifest.listingProducts!=='number'||!Number.isSafeInteger(manifest.listingProducts)||manifest.listingProducts<0
    ||typeof manifest.searchProducts!=='number'||!Number.isSafeInteger(manifest.searchProducts)||manifest.searchProducts<0
    ||manifest.searchProducts>manifest.products) {
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  }
  const categories=new Set<string>()
  for(const category of manifest.categories) {
    if(!CATEGORY_FAMILIES.has(category.slug)||categories.has(category.slug)||!Array.isArray(category.listings)) {
      throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    }
    const listingSlugs=new Set<string>()
    for(const listing of category.listings) {
      if(!listing||typeof listing.slug!=='string'||!SLUG.test(listing.slug)||listingSlugs.has(listing.slug)
        ||!Number.isSafeInteger(listing.totalCount)||listing.totalCount<1
        ||Math.ceil(listing.totalCount/PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)>PUBLIC_SNAPSHOT_LISTING_MAX_PAGES) {
        throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
      }
      listingSlugs.add(listing.slug)
    }
    categories.add(category.slug)
  }
  if(categories.size!==CATEGORY_FAMILIES.size) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
}

function assertProductionAssetDeclared(path:string,manifest:Manifest) {
  const listingMatch=/^listings\/([^/]+)\/([^/]+)\/([1-9][0-9]{0,3})\.json$/.exec(path)
  if(listingMatch) {
    const [,categorySlug,listingSlug,pageText]=listingMatch
    const category=manifest.categories.find((entry)=>entry.slug===categorySlug)
    const listing=category?.listings.find((entry)=>entry.slug===listingSlug)
    const page=Number(pageText)
    if(!listing||page>Math.ceil(listing.totalCount/PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)) {
      throw new Error('PUBLIC_CATALOGUE_ASSET_UNDECLARED')
    }
    return
  }
  const productMatch=/^products\/([a-f0-9]{2})\.json$/.exec(path)
  if(productMatch&&manifest.productBuckets.includes(productMatch[1])) return
  const searchMatch=/^search\/([0-3])\.json$/.exec(path)
  if(searchMatch&&manifest.searchShards?.includes(searchMatch[1])) return
  throw new Error('PUBLIC_CATALOGUE_ASSET_UNDECLARED')
}

async function fetchProductionCatalogueAsset(path:string,knownManifest?:Manifest):Promise<Response> {
  if(!PUBLIC_CATALOGUE_ASSET.test(path)) throw new Error('PUBLIC_CATALOGUE_ASSET_PATH_FORBIDDEN')
  if(path!=='manifest.json') {
    const manifest=knownManifest??await readSnapshotManifest()
    assertProductionAssetDeclared(path,manifest)
  }
  const url=new URL(`/__catalogue/v1/${path}`,PRODUCTION_PUBLIC_ORIGIN)
  let response:Response
  try {
    response=await fetch(url,{
      method:'GET',
      headers:{Accept:'application/json','Cache-Control':'no-cache'},
      cache:'no-store',
      credentials:'omit',
      redirect:'manual',
      signal:AbortSignal.timeout(12000),
    })
  } catch(error) {
    const errorName=error instanceof Error?error.name:''
    const reason=errorName==='TimeoutError'||errorName==='AbortError'?'timeout':'network'
    console.error(JSON.stringify({event:'PUBLIC_CATALOGUE_READ_FAILED',path,reason}))
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  }
  const contentType=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()
  if(response.status<200||response.status>=300||contentType!=='application/json'||response.headers.has('set-cookie')) {
    const reason=response.status<200||response.status>=300?'http-status':contentType!=='application/json'?'content-type':'set-cookie'
    console.error(JSON.stringify({event:'PUBLIC_CATALOGUE_READ_FAILED',path,reason,status:response.status}))
    throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
  }
  return response
}
export const readSnapshotManifest=cache(async()=>readAsset<Manifest>('manifest.json'))
export type SnapshotSearchProduct={id:number;sku:string;name:string;slug:string;url:string;price:number|null;original_price:number|null;list_price:number|null;sale_price:number|null;online_discount_amount:number|null;final_online_price:number|null;price_display:string|null;image_main_url:string|null;category_slug:string;subcategory_slug:string;brand_name:string|null;product_feature_values:{product_features:{name:string}}[];colors:{name:string;hex_code:string|null}|null}
export async function getSnapshotSearchProducts(){
 if(publicPostgresEnabled()) throw new Error('USE_PARAMETERIZED_DATABASE_SEARCH');
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
 if(publicPostgresEnabled()) return getLiveVariantSiblings(group,currentId);
 if(!/^public-[1-9][0-9]*$/.test(group)||!Number.isSafeInteger(currentId))return []
 const members=(await readSnapshotManifest()).variantGroups?.[group]
 if(!Array.isArray(members)||members.length<2||members.length>8
   ||!members.some(p=>p.id===currentId)||members.some(p=>p.variant_group!==group))return []
 return members.filter(p=>p.id!==currentId)
}
export async function getSnapshotCategories() { return publicPostgresEnabled()?getLiveCategories():(await readSnapshotManifest()).categories }
export async function getSnapshotCategoryRoot(categorySlug:string,brandSlugs:readonly string[]=[]){
  if(!SLUG.test(categorySlug)||brandSlugs.some(brandSlug=>!SLUG.test(brandSlug)))return null
  const category=(await getSnapshotCategories()).find(c=>c.slug===categorySlug)
  return category?buildSnapshotCategoryRoot(category,brandSlugs):null
}
export async function getSnapshotProducts(category:string,listing:string,page=1) {
 if(publicPostgresEnabled()) return getLiveListing(category,listing,page);
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
 if(publicPostgresEnabled()) return getLiveProduct(category,listing,slug);
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
