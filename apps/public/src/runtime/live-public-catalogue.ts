// Opt-in M1 PostgreSQL read model. Prices/stock are never asserted from
// historical unverified values; original database rows remain intact.
import { cache } from 'react'
import { sanitizeRichHtml } from '@/lib/html-sanitizer'
import { readPublicRows } from './public-db'
import type { SnapshotCategory, SnapshotProduct, SnapshotSearchProduct } from './public-snapshot-catalogue'

type Row = {
  id:number; sku:string; name:string; display_name:string|null; slug:string
  description:string|null; image_main_url:string|null; is_featured:boolean
  variant_group:string|null; variant_type:string|null; variant_label:string|null
  category_name:string; category_slug:string; listing_name:string; listing_slug:string
  brand_name:string|null; brand_slug:string|null; total_count?:number|string
  gallery_images?:{image_url:string}[]|null; description_html?:string|null
  specifications?:Record<string,string>|null; documents?:{name:string;url:string;type:string;size?:number|null}[]|null
  product_feature_values?:{product_features:{name:string}}[]|null
}
const COLS='p.id,p.sku,p.name,p.display_name,p.slug,p.description,p.image_main_url,p.is_featured,p.variant_group,p.variant_type,p.variant_label,c.name AS category_name,c.slug AS category_slug,s.name AS listing_name,s.slug AS listing_slug,b.name AS brand_name,b.slug AS brand_slug'
const FROM=" FROM dpg_app.products p JOIN dpg_app.categories c ON c.id=p.category_id AND c.is_active=true AND c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' JOIN dpg_app.subcategories s ON s.id=p.subcategory_id AND s.category_id=c.id AND s.is_active=true AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' LEFT JOIN dpg_app.brands b ON b.id=p.brand_id AND b.is_active=true"
// Keep malformed canonical paths out of every Public query. The mapper and
// route layer fail closed on these fields, so letting one row into a page would
// turn a valid listing/search/PDP request into a 503 instead of omitting it.
const PUBLIC_PRODUCT="p.is_active=true AND p.publication_status='public' AND p.pdp_visibility='public' AND p.id>0 AND p.name<>'' AND char_length(p.name)<=240 AND p.sku<>'' AND char_length(p.sku)<=120 AND p.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
const PUBLIC= " "+PUBLIC_PRODUCT+" AND c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
const LIST=" p.listing_visibility IN ('default','low_priority')"
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ROUTE_CATEGORIES=new Set(['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat'])
const HOSTS=new Set(['cdn.dongphugia.com.vn','dpg-products.b-cdn.net','cdn.hita.com.vn','hita.com.vn','vietceramics.com','tygjmrhandbffjllxveu.supabase.co'])
function safeImage(s:string|null){
 if(!s||s.length>2048)return null
 if(s.startsWith('/images/')&&!s.includes('..'))return s
 try{const u=new URL(s);return u.protocol==='https:'&&!u.search&&!u.hash&&!u.username&&!u.password
   &&HOSTS.has(u.hostname)&&(!u.hostname.endsWith('.supabase.co')||u.pathname.startsWith('/storage/v1/object/public/'))?u.href:null
 }catch{return null}
}
export function mapLiveProduct(row:Row):SnapshotProduct{
 if(!Number.isSafeInteger(row.id)||row.id<=0||![row.category_slug,row.listing_slug,row.slug].every(s=>SLUG.test(s))
   ||!row.name||row.name.length>240||!row.sku||row.sku.length>120)throw Error('PUBLIC_PRODUCT_DB_ROW_INVALID')
 const image=safeImage(row.image_main_url)
 const brand=row.brand_name&&row.brand_slug&&SLUG.test(row.brand_slug)?{name:row.brand_name,slug:row.brand_slug}:null
 return {
  id:row.id,sku:row.sku,name:row.name,display_name:row.display_name||row.name,slug:row.slug,
  price:null,price_display:'Liên hệ báo giá',stock_status:'contact',image_main_url:image,
  is_active:true,is_featured:Boolean(row.is_featured),is_promotion:false,variant_options:[],
  categories:{name:row.category_name,slug:row.category_slug},subcategories:{name:row.listing_name,slug:row.listing_slug},
  brands:brand,canonical_category_slug:row.category_slug,canonical_subcategory_slug:row.listing_slug,
  url:'/'+row.category_slug+'/'+row.listing_slug+'/'+row.slug,
  publicContent:{summary:row.description?.slice(0,12000)||null,descriptionBlocks:[],specifications:{},
   gallery:image?[image]:[],referencePrice:null},
  ...(row.variant_group?{variant_group:row.variant_group}:{}),
  ...(row.variant_type==='size'||row.variant_type==='seat_type'?{variant_type:row.variant_type}:{}),
  ...(row.variant_label?{variant_label:row.variant_label}:{}),
 }
}
export const getLiveListing=cache(async(category:string,listing:string,page=1,pageSize=48)=>{
 if(![category,listing].every(s=>SLUG.test(s))||!Number.isSafeInteger(page)||page<1||page>64||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>48)
  return {products:[] as SnapshotProduct[],totalCount:0,page}
 const rows=await readPublicRows<Row>('SELECT '+COLS+',count(*) OVER() AS total_count'+FROM+
   ' WHERE '+PUBLIC+' AND '+LIST+' AND c.slug=$1 AND s.slug=$2'+
   ' ORDER BY p.listing_priority DESC NULLS LAST,p.sort_order,p.id LIMIT $4 OFFSET $3',
   [category,listing,(page-1)*pageSize,pageSize])
 return {products:rows.map(mapLiveProduct),totalCount:Number(rows[0]?.total_count??0),page}
})
type ListingLeaf={slug:string;name:string;totalCount:number}
export const getLiveListingLeaves=cache(async(category:string):Promise<ListingLeaf[]>=>{
 if(!ROUTE_CATEGORIES.has(category)||!SLUG.test(category))return []
 const rows=await readPublicRows<{slug:string;name:string;total_count:number|string}>(
  'SELECT s.slug,s.name,count(p.id) AS total_count'+
  ' FROM dpg_app.categories c JOIN dpg_app.subcategories s ON s.category_id=c.id'+
  ' JOIN dpg_app.products p ON p.category_id=c.id AND p.subcategory_id=s.id'+
  ' WHERE c.is_active=true AND c.slug=$1 AND s.is_active=true'+
  " AND c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"+
  ' AND '+PUBLIC_PRODUCT+' AND '+LIST+
  ' GROUP BY s.id,s.slug,s.name HAVING count(p.id)>0 ORDER BY s.name,s.slug LIMIT 100',
  [category])
 return rows.flatMap(row=>{
  const totalCount=Number(row.total_count)
  return SLUG.test(row.slug)&&typeof row.name==='string'&&row.name.length>0&&row.name.length<=240
   &&Number.isSafeInteger(totalCount)&&totalCount>0?[{slug:row.slug,name:row.name,totalCount}]:[]
 })
})
type ListingRouteMetadata={categoryName:string;listingName:string}
export const getLiveListingRouteMetadata=cache(async(category:string,listing:string):Promise<ListingRouteMetadata|null>=>{
 if(!ROUTE_CATEGORIES.has(category)||!SLUG.test(category)||!SLUG.test(listing))return null
 const rows=await readPublicRows<ListingRouteMetadata>(
  'SELECT c.name AS "categoryName",s.name AS "listingName" FROM dpg_app.categories c'+
  ' JOIN dpg_app.subcategories s ON s.category_id=c.id AND s.is_active=true'+
  " AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"+
  ' WHERE c.is_active=true AND c.slug=$1 AND s.slug=$2'+
  ' AND EXISTS (SELECT 1 FROM dpg_app.products p WHERE p.category_id=c.id AND p.subcategory_id=s.id'+
  ' AND '+PUBLIC_PRODUCT+' AND '+LIST+') LIMIT 1',
  [category,listing])
 const row=rows[0]
 return row&&typeof row.categoryName==='string'&&row.categoryName.length>0&&row.categoryName.length<=240
  &&typeof row.listingName==='string'&&row.listingName.length>0&&row.listingName.length<=240
  ?{categoryName:row.categoryName,listingName:row.listingName}:null
})
type Count={category_slug:string;category_name:string;listing_slug:string;listing_name:string;total_count:number|string}
type Brand={category_slug:string;slug:string;name:string}
export const getLiveCategories=cache(async():Promise<SnapshotCategory[]>=>{
 const rows=await readPublicRows<Count>('SELECT c.slug AS category_slug,c.name AS category_name,s.slug AS listing_slug,'+
  's.name AS listing_name,count(p.id) AS total_count'+FROM+' WHERE '+PUBLIC+' AND '+LIST+
  ' GROUP BY c.slug,c.name,s.slug,s.name HAVING count(p.id)>0 ORDER BY c.slug,s.name LIMIT 100')
 const brands=await readPublicRows<Brand>('SELECT DISTINCT c.slug AS category_slug,b.slug,b.name'+FROM+
   ' WHERE '+PUBLIC+' AND '+LIST+' AND b.slug IS NOT NULL ORDER BY c.slug,b.slug LIMIT 500')
 const result=await Promise.all(['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat'].map(async (slug): Promise<SnapshotCategory | null>=>{
  const byCategory=rows.filter(r=>r.category_slug===slug)
  if(!byCategory.length)return null
  const listings=byCategory.map(r=>({slug:r.listing_slug,name:r.listing_name,thumbnail_url:null,totalCount:Number(r.total_count)}))
  const first=await getLiveListing(slug,listings[0].slug,1)
  return {slug,name:byCategory[0].category_name,listings,
   homeProducts:first.products.slice(0,8),
   featuredProducts:first.products.filter(p=>p.is_featured).slice(0,8),
   totalCount:listings.reduce((n,l)=>n+l.totalCount,0),
   brands:brands.filter(b=>b.category_slug===slug).map(b=>({slug:b.slug,name:b.name}))}
 }))
 return result.filter((x):x is SnapshotCategory=>x!==null)
})

export const getLiveBrandsForListing=cache(async(category:string,listing:string)=>{
 if(![category,listing].every(s=>SLUG.test(s)))return [] as {slug:string;name:string}[]
 return readPublicRows<{slug:string;name:string}>(
  'SELECT DISTINCT b.slug,b.name'+FROM+' WHERE '+PUBLIC+' AND '+LIST+
  ' AND c.slug=$1 AND s.slug=$2 AND b.slug IS NOT NULL ORDER BY b.slug LIMIT 32',
  [category,listing])
})
const loadLiveProduct=async(where:string,values:readonly string[])=>{
 const detailSelect=`
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('image_url',i.image_url) ORDER BY i.sort_order,i.id),'[]'::jsonb)
   FROM (SELECT id,image_url,sort_order FROM dpg_app.product_images WHERE product_id=p.id ORDER BY sort_order,id LIMIT 12) i) AS gallery_images,
  (SELECT pd.clean_html FROM dpg_app.product_descriptions pd WHERE pd.product_id=p.id ORDER BY pd.updated_at DESC,pd.id DESC LIMIT 1) AS description_html,
  (SELECT jsonb_object_agg(v.label,v.value) FROM (
    SELECT sd.label,COALESCE(NULLIF(BTRIM(psv.value_text),''),psv.value_number::text,so.value,psv.value_json#>>'{}',NULLIF(BTRIM(psv.raw_value),'')) AS value
    FROM dpg_app.product_spec_values psv
    JOIN dpg_app.spec_definitions sd ON sd.id=psv.spec_definition_id AND sd.is_pdp_visible=true
    LEFT JOIN dpg_app.spec_options so ON so.id=psv.option_id
    WHERE psv.product_id=p.id
    ORDER BY psv.sort_order,psv.id LIMIT 60
  ) v WHERE v.value IS NOT NULL) AS specifications,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('name',d.name,'url',d.url,'type',d.document_type,'size',d.file_size) ORDER BY d.sort_order,d.id),'[]'::jsonb)
   FROM (SELECT id,name,url,document_type,file_size,sort_order FROM dpg_app.product_documents WHERE product_id=p.id ORDER BY sort_order,id LIMIT 24) d) AS documents,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_features',jsonb_build_object('name',f.name)) ORDER BY f.sort_order,f.id),'[]'::jsonb)
   FROM (SELECT f.name,f.sort_order,f.id FROM dpg_app.product_feature_values fv JOIN dpg_app.product_features f ON f.id=fv.feature_id WHERE fv.product_id=p.id ORDER BY f.sort_order,f.id LIMIT 3) f) AS product_feature_values`
 const rows=await readPublicRows<Row>('SELECT '+COLS+','+detailSelect+FROM+' WHERE '+PUBLIC+' '+where+' LIMIT 1',values)
 if(!rows.length)return null
 const product=mapLiveProduct(rows[0])
 const gallery=[...new Set([product.image_main_url,...(rows[0].gallery_images??[]).map(i=>safeImage(i.image_url))]
  .filter((s):s is string=>Boolean(s)))]
 const specifications=Object.fromEntries(Object.entries(rows[0].specifications??{}).filter(([key,value])=>key.trim()&&value.trim()).slice(0,60))
 const documents=(rows[0].documents??[]).flatMap(doc=>{
  const url=safeImage(doc.url)
  return url&&doc.name&&doc.name.length<=240? [{name:doc.name.slice(0,240),url,type:doc.type.slice(0,80),size:doc.size===null||doc.size===undefined?'':String(doc.size)}]:[]
 })
 const descriptionHtml=rows[0].description_html?sanitizeRichHtml(rows[0].description_html):undefined
 return {...product,product_feature_values:rows[0].product_feature_values??[],publicContent:{...product.publicContent!,gallery,
  specifications,...(descriptionHtml?{descriptionHtml}:{}),documents},imageUrl:product.image_main_url,
  brand:product.brands??{name:'',slug:''},categoryName:product.categories.name,listingName:product.subcategories.name,
  categoryPath:'/'+product.categories.slug,listingPath:'/'+product.categories.slug+'/'+product.subcategories.slug,productPath:product.url,priceDisplay:product.price_display}
}
export const getLiveProduct=cache(async(category:string,listing:string,slug:string)=>{
 if(![category,listing,slug].every(s=>SLUG.test(s)))return null
 return loadLiveProduct('AND c.slug=$1 AND s.slug=$2 AND p.slug=$3',[category,listing,slug])
})
export const getLiveProductByCategory=cache(async(category:string,slug:string)=>{
 if(![category,slug].every(s=>SLUG.test(s)))return null
 return loadLiveProduct('AND c.slug=$1 AND p.slug=$2',[category,slug])
})
export async function searchLiveProducts(raw:string,page:number,limit:number){
 const query=raw.trim().slice(0,120)
 if(query.length<2||!Number.isSafeInteger(page)||page<1||page>100||!Number.isSafeInteger(limit)||limit<1||limit>48)
  return {results:[] as SnapshotSearchProduct[],total:0,page,limit,query}
 const rows=await readPublicRows<Row>('SELECT '+COLS+',count(*) OVER() AS total_count'+FROM+
  ' WHERE '+PUBLIC+" AND p.search_visibility='visible' AND (p.sku ILIKE $1 OR p.name ILIKE $1)"+
  " ORDER BY CASE WHEN lower(p.sku)=lower($2) THEN 0 WHEN lower(p.sku) LIKE lower($2)||'%' THEN 1 ELSE 2 END,p.name,p.id"+
  ' LIMIT $3 OFFSET $4',['%'+query+'%',query,limit,(page-1)*limit])
 const results=rows.map(row=>{
  const p=mapLiveProduct(row)
  return {id:p.id,sku:p.sku,name:p.name,slug:p.slug,url:p.url,price:null,original_price:null,
   list_price:null,sale_price:null,online_discount_amount:null,final_online_price:null,
   price_display:'Liên hệ báo giá',image_main_url:p.image_main_url,
   category_slug:p.categories.slug,subcategory_slug:p.subcategories.slug,
   brand_name:p.brands?.name??null,product_feature_values:[],colors:null} satisfies SnapshotSearchProduct
 })
 return {results,total:Number(rows[0]?.total_count??0),page,limit,query}
}
export async function getLiveVariantSiblings(group:string,currentId:number){
 if(!group||group.length>100||!Number.isSafeInteger(currentId))return [] as SnapshotProduct[]
 const rows=await readPublicRows<Row>('SELECT '+COLS+FROM+' WHERE '+PUBLIC+
  ' AND p.variant_group=$1 AND p.id<>$2 ORDER BY p.id LIMIT 8',[group,currentId])
 return rows.map(mapLiveProduct)
}
