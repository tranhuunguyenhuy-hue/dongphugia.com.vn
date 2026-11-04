// Run only in the protected runner after M3. This script is not imported by Public.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { connect, closeConnections, assertTargetPrivate } from './run.mjs'
import { assertPublicPreviewBudget } from './contract.mjs'
import type { ProductVisibilityInput } from '../../src/lib/public-product-visibility'
import type { ProductPathInput, ProductTaxonAssignmentRef } from '../../src/lib/taxonomy-paths'
import { projectProduct, buildProjection, ROOTS } from './public-projection.mjs'
import {projectPublicContent,publicText,PUBLIC_SPEC_KEYS,PUBLIC_LEGACY_SPEC_PATHS} from './public-product-content.mjs'

// Root .ts modules are CommonJS; this protected .mts runner is ESM. Keep the
// exact canonical implementations using tsx's registered CommonJS loader.
const require=createRequire(import.meta.url)
const {resolveProductVisibility}=require('../../src/lib/public-product-visibility.ts') as typeof import('../../src/lib/public-product-visibility')
const {getCanonicalProductPath}=require('../../src/lib/taxonomy-paths.ts') as typeof import('../../src/lib/taxonomy-paths')

type ProjectionRow = ProductVisibilityInput & ProductPathInput & {id:number;name:string;display_name:string|null;sku:string;image_main_url:string|null;is_featured:boolean;brand_name:string|null;brand_slug:string|null;rootSortOrder:number;rootBrandId:number|null;rootBrandSortOrder:number|null;rootSubcategorySortOrder:number|null;rootSubcategoryThumbnailUrl:string|null;product_taxon_assignments:ProductTaxonAssignmentRef[]}
type LegacyVariantRow=ProjectionRow & {variant_group:string|null;variant_group_id:number|null;variant_label:string|null;variant_type:string|null;is_combo:boolean}
let projectionPhase='PRECHECK'
const REPO='tranhuunguyenhuy-hue/dongphugia.com.vn'
function parseBudgetEvidence(raw:string|undefined) {
  try{return JSON.parse(raw??'null')}catch{throw new Error('ZERO_COST_EVIDENCE_INVALID')}
}
function assertPreviewBudget() {
  const publicationMode=process.env.DIRECT_PUBLIC_PREVIEW_PUBLISH
  // This workflow unit reads a private target and writes only a sanitized local
  // candidate artifact. Billing remains UNKNOWN; it does not claim zero cost.
  if(publicationMode==='false') {
    if(process.env.GITHUB_WORKFLOW_REF!==`${REPO}/.github/workflows/catalogue-public-preview-v2.yml@refs/heads/main`)
      throw new Error('PREVIEW2_READ_ONLY_SCOPE_REQUIRED')
    return
  }
  if(publicationMode==='true') return assertPublicPreviewBudget(true,
    parseBudgetEvidence(process.env.DIRECT_ZERO_COST_ATTESTATION),undefined)
  return assertPublicPreviewBudget(undefined,undefined,undefined)
}
function proof() {
  const runId=process.env.PUBLIC_CATALOGUE_M3_RUN_ID??''
  const checkpoint=process.env.PUBLIC_CATALOGUE_M1_CHECKPOINT??''
  if(!/^[0-9]+$/.test(runId)||!/^[a-f0-9]{40}$/.test(checkpoint)) throw new Error('M3_PROOF_REQUIRED')
  // Capture only in protected memory. Never print raw logs or their Environment prelude.
  const result=JSON.parse(execFileSync('gh',['api',`repos/${REPO}/actions/runs/${runId}`],{encoding:'utf8'}))
  if(result.conclusion!=='success'||result.event!=='workflow_dispatch'||result.head_branch!=='main'
    ||result.run_attempt!==1||result.path!=='.github/workflows/catalogue-direct-migration.yml'
    ||result.actor?.login!=='tranhuunguyenhuy-hue') throw new Error('M3_RUN_NOT_VERIFIED')
  const log=execFileSync('gh',['run','view',runId,'--repo',REPO,'--log'],{encoding:'utf8',maxBuffer:16000000})
  const matches=log.split('\n').flatMap(line=>{
    const i=line.indexOf('{"status":"PASS"');if(i<0)return[]
    try{return[JSON.parse(line.slice(i))]}catch{return[]}
  }).filter(value=>value.stage==='M3'&&value.tables===27&&value.checkpoint===checkpoint)
  if(matches.length!==1) throw new Error('M3_EXACT_CHECKPOINT_NOT_VERIFIED')
  execFileSync('git',['merge-base','--is-ancestor',result.head_sha,process.env.GITHUB_SHA??''],{stdio:'pipe'})
  return {checkpoint,m3CodeSha:result.head_sha,m3RunId:runId}
}

async function main() {
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/main'
    ||process.env.GITHUB_ACTOR!=='tranhuunguyenhuy-hue'||process.env.GITHUB_RUN_ATTEMPT!=='1') throw new Error('PROTECTED_BUILD_REQUIRED')
  assertPreviewBudget()
  projectionPhase='M3_PROOF'
  const evidence=proof()
  projectionPhase='CONNECT_READ'
  const client=await connect('read')
  await client.query('begin isolation level repeatable read read only')
  projectionPhase='TARGET_PRIVACY'
  await assertTargetPrivate(client)
  projectionPhase='PUBLIC_QUERY'
  // Explicit selected fields only: no Auth, Storage, orders, customer records,
  // Source URLs and raw rows remain protected in runner memory. Explicitly
  // allowlisted historical prices, public description and documents are emitted.
  const result=await client.query(`select p.id,p.name,p.display_name,p.slug,p.sku,p.product_type,p.image_main_url,p.is_featured,
    p.price,p.original_price,p.list_price,p.sale_price,p.online_discount_amount,
    p.price_display,p.price_updated_at,p.price_source,p.price_state,p.price_confidence,p.source_system,p.source_url,
    p.variant_group,p.variant_group_id,p.variant_label,p.variant_type,p.is_combo,
    p.sort_order as "rootSortOrder",b.id as "rootBrandId",b.sort_order as "rootBrandSortOrder",
    color.name as "cardColorName",color.hex_code as "cardColorHex",
    coalesce((select jsonb_agg(f.name) from (select pf.name from dpg_app.product_feature_values pfv
      join dpg_app.product_features pf on pf.id=pfv.feature_id
      where pfv.product_id=p.id order by pf.sort_order,pfv.id limit 3) f),'[]'::jsonb) as "cardFeatures",
    case when c.slug='gach-op-lat' and coalesce(root_taxonomy.has_taxon,false)
      then root_taxonomy.sort_order else s.sort_order end as "rootSubcategorySortOrder",
    case when c.slug='gach-op-lat' and coalesce(root_taxonomy.has_taxon,false)
      then null else s.thumbnail_url end as "rootSubcategoryThumbnailUrl",
    p.is_active,p.stock_status,p.sellable_status,p.publication_status,p.pdp_visibility,p.listing_visibility,
    p.search_visibility,p.seo_indexing,p.sitemap_include,
    case when octet_length(p.description)<=20000 then p.description else null end as "publicDescription",
    coalesce((select jsonb_agg(jsonb_build_object('key',v.key,'isPdpVisible',true,'value',v.value)) from
      (select sd.key,coalesce(so.value,sv.value_text,sv.value_number::text) as value
       from dpg_app.product_spec_values sv join dpg_app.spec_definitions sd on sd.id=sv.spec_definition_id
       left join dpg_app.spec_options so on so.id=sv.option_id
       where sv.product_id=p.id and sd.is_pdp_visible and sd.key=any($1::text[])
       order by sd.sort_order,sv.sort_order,sv.id limit 100) v),'[]'::jsonb) ||
    coalesce((select jsonb_agg(jsonb_build_object('key',m.label,'isPdpVisible',true,'value',p.specs->>m.path))
      from jsonb_each_text($2::jsonb) as m(path,label)
      where jsonb_typeof(p.specs->m.path) in ('string','number') and octet_length(p.specs->>m.path)<=2000),'[]'::jsonb) as "publicSpecifications",
    coalesce((select jsonb_agg(i.image_url) from (select image_url from dpg_app.product_images
      where product_id=p.id and image_type='gallery' order by sort_order,id limit 12)i),'[]'::jsonb) as "publicGallery",
    coalesce((select jsonb_agg(jsonb_build_object('name',d.name,'url',d.url,'document_type',d.document_type,'file_ext',d.file_ext,'file_size',d.file_size))
      from (select name,url,document_type,file_ext,file_size from dpg_app.product_documents
        where product_id=p.id order by sort_order,id limit 20)d),'[]'::jsonb) as "publicDocuments",
    jsonb_build_object('slug',c.slug,'name',c.name) as categories,
    case when s.id is null then null else jsonb_build_object('slug',s.slug,'name',s.name) end as subcategories,
    case when b.is_active then b.name else null end as brand_name,
    case when b.is_active then b.slug else null end as brand_slug,
    coalesce((select jsonb_agg(jsonb_build_object('is_primary',a.is_primary,'catalog_taxons',
      jsonb_build_object('slug',t.slug,'name',t.name,'canonical_path',t.canonical_path,'parent_id',t.parent_id,
      'is_active',t.is_active,'is_listing_enabled',t.is_listing_enabled)))
      from dpg_app.product_taxon_assignments a join dpg_app.catalog_taxons t on t.id=a.taxon_id
      where a.product_id=p.id and a.is_primary),'[]'::jsonb) as product_taxon_assignments
    from dpg_app.products p join dpg_app.categories c on c.id=p.category_id
    left join dpg_app.subcategories s on s.id=p.subcategory_id
    left join dpg_app.brands b on b.id=p.brand_id
    left join dpg_app.colors color on color.id=p.color_id
    left join lateral (
      select min(t.sort_order) as sort_order,count(*)>0 as has_taxon
      from dpg_app.product_taxon_assignments a
      join dpg_app.catalog_taxons t on t.id=a.taxon_id
      where a.product_id=p.id and a.is_primary and t.is_active
        and t.canonical_path like 'gach-op-lat/%'
    ) root_taxonomy on true
    where c.is_active and (s.id is null or s.is_active)
      and p.is_active and p.stock_status<>'discontinued' and p.sellable_status='sellable'
      and p.publication_status='public' and p.pdp_visibility='public'
    order by p.is_featured desc,p.listing_priority desc,p.sort_order,p.id`,[PUBLIC_SPEC_KEYS,JSON.stringify(PUBLIC_LEGACY_SPEC_PATHS)])
  projectionPhase='PUBLIC_TRANSFORM'
  const rows = result.rows as LegacyVariantRow[]
  const activeCategories = new Set((await client.query('select slug from dpg_app.categories where is_active')).rows.map((row: {slug:string}) => row.slug))
  const rootRows=(await client.query(`select c.slug as "categorySlug",c.name as "categoryName",
      s.slug as "subcategorySlug",s.name as "subcategoryName",s.sort_order as "subcategorySortOrder",
      s.thumbnail_url as "subcategoryThumbnailUrl"
    from dpg_app.categories c
    left join dpg_app.subcategories s on s.category_id=c.id and s.is_active
    where c.is_active and c.slug=any($1::text[])
    order by c.sort_order,c.slug,s.sort_order,s.slug`,[ROOTS])).rows as {
      categorySlug:string;categoryName:string;subcategorySlug:string|null;subcategoryName:string|null;
      subcategorySortOrder:number|null;subcategoryThumbnailUrl:string|null
    }[]
  const rootMap=new Map<string,{slug:string;name:string;listings:{slug:string;name:string;sortOrder:number;thumbnailUrl:string|null}[]}>()
  for(const row of rootRows){
    let root=rootMap.get(row.categorySlug)
    if(!root){root={slug:row.categorySlug,name:row.categoryName,listings:[]};rootMap.set(row.categorySlug,root)}
    // Gạch uses getPublicListingLeaves, which excludes empty legacy leaves;
    // populated leaves are reconstructed from eligible product paths below.
    if(row.categorySlug!=='gach-op-lat'&&row.subcategorySlug&&row.subcategoryName){
      root.listings.push({slug:row.subcategorySlug,name:row.subcategoryName,sortOrder:row.subcategorySortOrder??0,thumbnailUrl:row.subcategoryThumbnailUrl})
    }
  }
  const rootMetadata=[...rootMap.values()]
  const projectedPairs=rows.map(row => {
    const canonical = getCanonicalProductPath(row)
    if (!activeCategories.has(canonical.categorySlug)) return null
    const visibility = resolveProductVisibility(row)
    const primaries = row.product_taxon_assignments.filter(assignment => assignment.is_primary)
    const primaryListing = primaries.length === 0 || (primaries.length === 1 && primaries[0].catalog_taxons?.is_listing_enabled === true)
    const product=projectProduct(row,{...visibility,listing:visibility.listing && primaryListing},canonical,{restoreCommerce:true})
    return product?{row,product:{...product,publicContent:projectPublicContent(row,{rich:true})}}:null
  }).filter((pair):pair is NonNullable<typeof pair>=>pair!==null)
  // Legacy groups are never the approved Family model. Only a small, fully
  // public one-axis sibling subset with exact independent PDP targets is used.
  const rawGroups=await client.query(`select vg.id,vg.group_key,vg.source,vg.confidence,vg.variant_type,
    (select count(*)::integer from dpg_app.products all_p where all_p.variant_group=vg.group_key) as "allMemberCount"
    from dpg_app.product_variant_groups vg where
      (vg.confidence='high' and vg.source like 'hita-normalized-%' and vg.variant_type=any($1::text[]))
      or (vg.id=237 and vg.group_key='MS636' and vg.source='legacy-products'
        and vg.confidence='medium' and vg.variant_type='seat_type')`,[['size','seat_type']])
  const allowedGroups=new Map(rawGroups.rows.map((group: {id:number;group_key:string;source:string;confidence:string;variant_type:string;allMemberCount:number})=>[group.group_key,group]))
  const candidates=new Map<string,typeof projectedPairs>()
  for(const pair of projectedPairs){
    const key=pair.row.variant_group
    if(!key)continue
    if(!candidates.has(key))candidates.set(key,[])
    candidates.get(key)!.push(pair)
  }
  const publicVariantById=new Map<number,{variant_group:string;variant_type:string;variant_label:string}>()
  for(const [key,members] of candidates){
    const group=allowedGroups.get(key)
    const ms636=key==='MS636'&&group?.id===237&&group.source==='legacy-products'
      &&group.confidence==='medium'&&group.variant_type==='seat_type'
      &&group.allMemberCount===4&&members.length===3
      &&new Set(members.map(({row})=>row.sku)).size===3
      &&['MS636DT2#XW','MS636DT8#XW','MS636CDRW23#XW'].every(sku=>members.some(({row})=>row.sku===sku))
    if(!group||members.length<2||members.length>8||(!ms636&&group.allMemberCount!==members.length)
      ||members.some(({row,product})=>row.variant_group_id!==group.id||row.variant_type!==group.variant_type
        // MS636DT2 is the one recorded toilet + soft-close seat bundle in this
        // exact bowl/seat series. Other bundles never become variants.
        ||(row.is_combo&&!(ms636&&row.sku==='MS636DT2#XW'))||product.listingEligible!==true))continue
    const first=members[0].product
    if(!first.brands?.slug||members.some(({product})=>product.categories.slug!==first.categories.slug
      ||product.subcategories.slug!==first.subcategories.slug||product.brands?.slug!==first.brands?.slug))continue
    const labels=members.map(({row})=>publicText(row.variant_label??(ms636&&row.sku==='MS636DT2#XW'?'Nắp đóng êm TC393VS':null),100))
    if(labels.some(label=>!label)||new Set(labels.map(label=>label!.toLocaleLowerCase('vi'))).size!==members.length
      ||new Set(members.map(({product})=>product.sku)).size!==members.length
      ||new Set(members.map(({product})=>product.url)).size!==members.length)continue
    members.forEach(({product},index)=>publicVariantById.set(product.id,{
      variant_group:`public-${group.id}`,variant_type:group.variant_type,variant_label:labels[index]!,
    }))
  }
  const projected=projectedPairs.map(({product})=>({...product,...publicVariantById.get(product.id)}))
  projectionPhase='PUBLIC_ASSEMBLY'
  const {manifest,assets}=buildProjection(projected,evidence,rootMetadata,{restoreCommerce:true})
  if(!manifest.products||!manifest.listingProducts) throw new Error('PUBLIC_PROJECTION_EMPTY_REVIEW_REQUIRED')
  await client.query('commit')
  projectionPhase='ASSET_WRITE'
  const output=resolve('apps/public/dist/client/__catalogue/v1')
  await mkdir(resolve('apps/public/dist/client/__catalogue'),{recursive:true})
  await mkdir(output) // existing snapshot refuses replacement/replay
  let bytes=0
  for(const [name,value] of assets) {
    const content=JSON.stringify(value)
    if(Buffer.byteLength(content)>2000000) throw new Error('PUBLIC_ASSET_CAPACITY')
    bytes+=Buffer.byteLength(content)
    await mkdir(resolve(output,name,'..'),{recursive:true})
    await writeFile(resolve(output,name),content,{mode:0o600})
  }
  if(bytes>100000000||assets.size>5000) throw new Error('PUBLIC_PROJECTION_CAPACITY')
  const exceptions=projectedPairs.flatMap(({row,product})=>{
    const reasons:string[]=[]
    if(product.price===null)reasons.push('CONTACT_ONLY_PRICE_UNVERIFIED')
    else if(row.price_source==='hita'){
      if(product.original_price===null)reasons.push('ORIGINAL_PRICE_UNVERIFIED')
      if(Number(row.sale_price)!==product.price)reasons.push('HISTORICAL_SALE_FIELD_CONFLICT')
      if(row.online_discount_amount!==null&&Number(row.online_discount_amount)>0
        &&product.online_discount_amount===null)reasons.push('ONLINE_DISCOUNT_INVALID')
    }
    return reasons.length?[{sku:product.sku,reasons}]:[]
  })
  const exceptionPath=process.env.PUBLIC_PRICE_EXCEPTIONS_PATH
  if(exceptionPath){
    if(process.env.GITHUB_ACTIONS!=='true'||!exceptionPath.endsWith('/evidence/price-exceptions.json'))throw new Error('PUBLIC_PRICE_EXCEPTIONS_PATH_INVALID')
    await mkdir(resolve(exceptionPath,'..'),{recursive:true})
    await writeFile(exceptionPath,JSON.stringify({contract:'dpg:public-price-exceptions:v1',checkpoint:evidence.checkpoint,
      products:projected.length,items:exceptions},null,2)+'\n',{mode:0o600})
  }
  const headersPath = resolve('apps/public/dist/client/_headers')
  const existingHeaders = await readFile(headersPath, 'utf8').catch(() => '')
  if (!existingHeaders.includes('/__catalogue/*')) await writeFile(headersPath, existingHeaders + '\n/__catalogue/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: private, no-store\n')
  // Only public projection DTO assets are emitted. Raw SQL rows stay in memory.
  console.log(JSON.stringify({status:'PASS',stage:'M4_PUBLIC_PROJECTION',...evidence,
    publicProducts:manifest.products,listingProducts:manifest.listingProducts,excludedInvalidCanonical:rows.length-projected.length,assets:assets.size,bytes,
    historicalReferencePrices:manifest.contentStats.referencePrices,verifiedVariantProducts:publicVariantById.size,
    publicPrices:manifest.contentStats.publicPrices,hitaPrices:manifest.contentStats.hitaPrices,
    onlineFinalPrices:manifest.contentStats.onlineFinalPrices,priceExceptions:exceptions.length,
    inventory:'CONFIRM_WITH_OWNER',privateFieldsExported:false}))
}
main().catch(error=>{
 const reasons=new Set(['PUBLIC_PROJECTION_UNSAFE_CONTENT','PUBLIC_PROJECTION_UNSAFE_DTO','PUBLIC_PROJECTION_DUPLICATE_CANONICAL_PATH','PUBLIC_PROJECTION_M3_EVIDENCE_REQUIRED','PUBLIC_PROJECTION_EMPTY_REVIEW_REQUIRED','PUBLIC_ASSET_CAPACITY','PUBLIC_PROJECTION_CAPACITY','M3_RUN_NOT_VERIFIED','M3_EXACT_CHECKPOINT_NOT_VERIFIED'])
 const reason=reasons.has(error?.message)?error.message:'PROTECTED_BUILD_FAILED'
 const sqlCode=['42501','42703','42P01','22023','57014','53200','53300'].includes(error?.code)?error.code:null
 console.error(JSON.stringify({status:'STOP',stage:'M4_PUBLIC_PROJECTION',phase:projectionPhase,reason,sqlCode}));process.exitCode=1
})
  .finally(closeConnections)
