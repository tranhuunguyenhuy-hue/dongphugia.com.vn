import { cache } from 'react'
import { usesPublicSnapshot, publicSnapshotCheckpoint } from './public-snapshot-mode'
export { usesPublicSnapshot } from './public-snapshot-mode'

const CONTRACT='dpg:public-catalogue-snapshot:v1'
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const PUBLIC_SNAPSHOT_NOTICE='Catalogue khôi phục ở chế độ chỉ đọc. Giá và tồn kho cần được xác nhận; vui lòng liên hệ Đông Phú Gia để nhận báo giá hiện tại.'
export type SnapshotProduct={
  id:number;name:string;display_name:string;slug:string;sku:string;price:null;price_display:string;stock_status:'contact';
  image_main_url:string|null;is_active:true;is_featured:boolean;is_promotion:false;variant_options:[];
  categories:{name:string;slug:string};subcategories:{name:string;slug:string};brands:{name:string;slug:string}|null;
  canonical_category_slug:string;canonical_subcategory_slug:string;url:string;
}
type SnapshotListing={slug:string;name:string;totalCount:number}
type SnapshotCategory={slug:string;name:string;listings:SnapshotListing[];homeProducts:SnapshotProduct[];totalCount:number}
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
    if (Array.isArray(v)) return v.map(repair)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='image_main_url'&&typeof x==='string'&&x.startsWith('https://cdn.dongphugia.com.vn/')?x.replace('https://cdn.dongphugia.com.vn/','https://dpg-products.b-cdn.net/'):repair(x)]))
    return v
  }
  return repair(value) as T
}
export const readSnapshotManifest=cache(async()=>readAsset<Manifest>('manifest.json'))
export async function getSnapshotCategories() { return (await readSnapshotManifest()).categories }
export async function getSnapshotProducts(category:string,listing:string,page=1) {
  if(!SLUG.test(category)||!SLUG.test(listing)||!Number.isSafeInteger(page)||page<1) return {products:[],totalCount:0,page}
  const categoryRecord=(await getSnapshotCategories()).find(c=>c.slug===category)
  const list=categoryRecord?.listings.find(l=>l.slug===listing)
  if(!list||page>Math.ceil(list.totalCount/48)) return {products:[],totalCount:list?.totalCount??0,page}
  const result=await readAsset<AssetEnvelope>(`listings/${category}/${listing}/${page}.json`)
  return {products:result.products??[],totalCount:result.totalCount??0,page}
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
