import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isSafePublicContent } from './public-product-content.mjs'

const fail=reason=>{throw new Error(`PREVIEW2_CANDIDATE_${reason}`)}
async function boundedJson(file,max=2_000_000){
 const bytes=await readFile(file)
 if(bytes.length>max)fail('ASSET_OVERSIZE')
 try{return JSON.parse(bytes)}catch{fail('ASSET_INVALID_JSON')}
}
export async function auditPreview2Candidate(buildRoot,{minProducts=5000,expectedBuckets=256}={}){
 const root=path.resolve(buildRoot,'assets/__catalogue/v1')
 const manifest=await boundedJson(path.join(root,'manifest.json'))
 if(manifest.contract!=='dpg:public-catalogue-snapshot:v1'||manifest.contentPolicy!=='canonical-public-content-v3'
   ||!Number.isSafeInteger(manifest.products)||manifest.products<minProducts
   ||!Array.isArray(manifest.productBuckets)||manifest.productBuckets.length!==expectedBuckets)fail('MANIFEST_IDENTITY')
 const products=new Map(),paths=new Set()
 let referencePrices=0,descriptionBlocks=0
 for(const bucket of manifest.productBuckets){
  if(!/^[a-f0-9]{2}$/.test(bucket))fail('BUCKET_NAME')
  const asset=await boundedJson(path.join(root,'products',`${bucket}.json`))
  if(asset.contract!==manifest.contract||asset.checkpoint!==manifest.checkpoint||!Array.isArray(asset.products))fail('BUCKET_IDENTITY')
  for(const product of asset.products){
   if(!Number.isSafeInteger(product.id)||products.has(product.id)||typeof product.url!=='string'||paths.has(product.url)
     ||product.price!==null||product.price_display!=='Liên hệ báo giá'||product.stock_status!=='contact'
     ||product.is_promotion!==false||!Array.isArray(product.variant_options)||product.variant_options.length!==0
     ||!isSafePublicContent(product.publicContent))fail('PRODUCT_UNSAFE')
   products.set(product.id,product);paths.add(product.url)
   if(product.publicContent.referencePrice)referencePrices++
   if(product.publicContent.descriptionBlocks.length)descriptionBlocks++
  }
 }
 if(products.size!==manifest.products||referencePrices!==manifest.contentStats?.referencePrices
   ||descriptionBlocks!==manifest.contentStats?.descriptionBlocks)fail('COUNT_MISMATCH')
 let variantProducts=0
 const groups=manifest.variantGroups
 if(!groups||typeof groups!=='object'||Array.isArray(groups))fail('VARIANT_GROUPS_MISSING')
 for(const [key,members] of Object.entries(groups)){
  if(!/^public-[1-9][0-9]*$/.test(key)||!Array.isArray(members)||members.length<2||members.length>8)fail('VARIANT_GROUP_UNSAFE')
  for(const member of members){
   const canonical=products.get(member.id)
   if(!canonical||canonical.variant_group!==key||canonical.url!==member.url
     ||canonical.sku!==member.sku||canonical.variant_label!==member.variant_label
     ||member.price!==null||member.stock_status!=='contact'||member.publicContent!==undefined)fail('VARIANT_TARGET_UNSAFE')
   variantProducts++
  }
 }
 if(variantProducts!==manifest.contentStats?.variantProducts
   ||[...products.values()].filter(p=>p.variant_group).length!==variantProducts)fail('VARIANT_COUNT_MISMATCH')
 const listingIds=new Set()
 let listingCount=0,listingPages=0
 for(const category of manifest.categories??[]){
  for(const listing of category.listings??[]){
   if(!Number.isSafeInteger(listing.totalCount)||listing.totalCount<1)fail('LISTING_COUNT')
   let seen=0
   for(let page=1;page<=Math.ceil(listing.totalCount/48);page++){
    const shard=await boundedJson(path.join(root,'listings',category.slug,listing.slug,`${page}.json`))
    const expected=Math.min(48,listing.totalCount-(page-1)*48)
    if(shard.contract!==manifest.contract||shard.checkpoint!==manifest.checkpoint
      ||shard.page!==page||shard.totalCount!==listing.totalCount
      ||!Array.isArray(shard.products)||shard.products.length!==expected)fail('LISTING_SHARD')
    for(const product of shard.products){
     const canonical=products.get(product.id)
     if(!canonical||canonical.url!==product.url
       ||canonical.categories?.slug!==category.slug||canonical.subcategories?.slug!==listing.slug
       ||listingIds.has(product.id))fail('LISTING_PRODUCT')
     listingIds.add(product.id)
     seen++
    }
    listingPages++
   }
   if(seen!==listing.totalCount)fail('LISTING_COUNT')
   listingCount+=seen
  }
 }
 if(listingCount!==manifest.listingProducts)fail('LISTING_COUNT')
 return {status:'PASS',contract:'dpg:preview2-candidate-audit:v1',products:products.size,
  historicalReferencePrices:referencePrices,contactOnlyProducts:products.size-referencePrices,
  descriptionBlockProducts:descriptionBlocks,variantGroups:Object.keys(groups).length,variantProducts,listingCount,listingPages,
  transactionalPrices:'CONTACT_ONLY',privateFieldsExported:false}
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [, ,buildRoot,output]=process.argv
 if(!buildRoot||!output)fail('ARGUMENT')
 auditPreview2Candidate(buildRoot).then(async proof=>{
  await writeFile(output,JSON.stringify(proof,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify(proof))
 }).catch(error=>{console.error(error.message?.startsWith('PREVIEW2_CANDIDATE_')?error.message:'PREVIEW2_CANDIDATE_FAILED');process.exitCode=1})
}
