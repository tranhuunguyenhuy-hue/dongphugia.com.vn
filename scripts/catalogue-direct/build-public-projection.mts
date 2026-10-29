// Run only in the protected runner after M3. This script is not imported by Public.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { connect, closeConnections, assertTargetPrivate } from './run.mjs'
import { assertBudget } from './contract.mjs'
import type { ProductVisibilityInput } from '../../src/lib/public-product-visibility'
import type { ProductPathInput, ProductTaxonAssignmentRef } from '../../src/lib/taxonomy-paths'
import { projectProduct, buildProjection } from './public-projection.mjs'

// Root .ts modules are CommonJS; this protected .mts runner is ESM. Keep the
// exact canonical implementations using tsx's registered CommonJS loader.
const require=createRequire(import.meta.url)
const {resolveProductVisibility}=require('../../src/lib/public-product-visibility.ts') as typeof import('../../src/lib/public-product-visibility')
const {getCanonicalProductPath}=require('../../src/lib/taxonomy-paths.ts') as typeof import('../../src/lib/taxonomy-paths')

type ProjectionRow = ProductVisibilityInput & ProductPathInput & {id:number;name:string;display_name:string|null;sku:string;image_main_url:string|null;is_featured:boolean;brand_name:string|null;brand_slug:string|null;product_taxon_assignments:ProductTaxonAssignmentRef[]}
const REPO='tranhuunguyenhuy-hue/dongphugia.com.vn'
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
  assertBudget(JSON.parse(process.env.DIRECT_ZERO_COST_ATTESTATION??'null'))
  const evidence=proof()
  const client=await connect('read')
  await client.query('begin isolation level repeatable read read only')
  await assertTargetPrivate(client)
  // Explicit selected fields only: no Auth, Storage, orders, customer records,
  // source URLs, descriptions/spec blobs, raw prices or arbitrary JSON.
  const result=await client.query(`select p.id,p.name,p.display_name,p.slug,p.sku,p.product_type,p.image_main_url,p.is_featured,
    p.is_active,p.stock_status,p.sellable_status,p.publication_status,p.pdp_visibility,p.listing_visibility,
    p.search_visibility,p.seo_indexing,p.sitemap_include,
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
    where c.is_active and (s.id is null or s.is_active)
      and p.is_active and p.stock_status<>'discontinued' and p.sellable_status='sellable'
      and p.publication_status='public' and p.pdp_visibility='public'
    order by p.is_featured desc,p.listing_priority desc,p.sort_order,p.id`)
  const rows = result.rows as ProjectionRow[]
  const activeCategories = new Set((await client.query('select slug from dpg_app.categories where is_active')).rows.map((row: {slug:string}) => row.slug))
  const projected=rows.map(row => {
    const canonical = getCanonicalProductPath(row)
    if (!activeCategories.has(canonical.categorySlug)) return null
    const visibility = resolveProductVisibility(row)
    const primaries = row.product_taxon_assignments.filter(assignment => assignment.is_primary)
    const primaryListing = primaries.length === 0 || (primaries.length === 1 && primaries[0].catalog_taxons?.is_listing_enabled === true)
    return projectProduct(row,{...visibility,listing:visibility.listing && primaryListing},canonical)
  }).filter(Boolean)
  const {manifest,assets}=buildProjection(projected,evidence)
  if(!manifest.products||!manifest.listingProducts) throw new Error('PUBLIC_PROJECTION_EMPTY_REVIEW_REQUIRED')
  await client.query('commit')
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
  const headersPath = resolve('apps/public/dist/client/_headers')
  const existingHeaders = await readFile(headersPath, 'utf8').catch(() => '')
  if (!existingHeaders.includes('/__catalogue/*')) await writeFile(headersPath, existingHeaders + '\n/__catalogue/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: private, no-store\n')
  // Only public projection DTO assets are emitted. Raw SQL rows stay in memory.
  console.log(JSON.stringify({status:'PASS',stage:'M4_PUBLIC_PROJECTION',...evidence,
    publicProducts:manifest.products,listingProducts:manifest.listingProducts,excludedInvalidCanonical:rows.length-projected.length,assets:assets.size,bytes,
    prices:'CONTACT_ONLY',inventory:'CONFIRM_WITH_OWNER',privateFieldsExported:false}))
}
main().catch(()=>{console.error('PUBLIC_PROJECTION status=STOP reason=PROTECTED_BUILD_FAILED');process.exitCode=1})
  .finally(closeConnections)
