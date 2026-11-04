import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isSafePublicContent } from './public-product-content.mjs'
import { isRestoredPublicPricing } from './public-restored-pricing.mjs'

const fail=reason=>{throw new Error(`PREVIEW2_CANDIDATE_${reason}`)}
async function boundedJson(file,max=2_000_000){
 const bytes=await readFile(file)
 if(bytes.length>max)fail('ASSET_OVERSIZE')
 try{return JSON.parse(bytes)}catch{fail('ASSET_INVALID_JSON')}
}
export async function auditPreview2Candidate(buildRoot,{minProducts=5000,expectedBuckets=256}={}){
 const root=path.resolve(buildRoot,'assets/__catalogue/v1')
 const manifest=await boundedJson(path.join(root,'manifest.json'))
 const restored=manifest.contentPolicy==='canonical-public-content-v4'
 if(manifest.contract!=='dpg:public-catalogue-snapshot:v1'||!['canonical-public-content-v3','canonical-public-content-v4'].includes(manifest.contentPolicy)
   ||!Number.isSafeInteger(manifest.products)||manifest.products<minProducts
   ||!Array.isArray(manifest.productBuckets)||manifest.productBuckets.length!==expectedBuckets)fail('MANIFEST_IDENTITY')
 const products=new Map(),paths=new Set()
 let referencePrices=0,descriptionBlocks=0,publicPrices=0,onlineFinalPrices=0,hitaPrices=0,manualPrices=0,verifiedOriginalPrices=0,richDescriptions=0,productsWithDocuments=0
 for(const bucket of manifest.productBuckets){
  if(!/^[a-f0-9]{2}$/.test(bucket))fail('BUCKET_NAME')
  const asset=await boundedJson(path.join(root,'products',`${bucket}.json`))
  if(asset.contract!==manifest.contract||asset.checkpoint!==manifest.checkpoint||!Array.isArray(asset.products))fail('BUCKET_IDENTITY')
  for(const product of asset.products){
   const priceKeys=['price','original_price','list_price','sale_price','online_discount_amount','final_online_price','price_display','is_promotion','price_provenance']
   const price=Object.fromEntries(priceKeys.map(key=>[key,product[key]]))
   if(!Number.isSafeInteger(product.id)||products.has(product.id)||typeof product.url!=='string'||paths.has(product.url)
     ||(restored?!isRestoredPublicPricing(price):product.price!==null||product.price_display!=='Liên hệ báo giá'||product.is_promotion!==false)
     ||product.stock_status!=='contact'||!Array.isArray(product.variant_options)||product.variant_options.length!==0
     ||!isSafePublicContent(product.publicContent))fail('PRODUCT_UNSAFE')
   products.set(product.id,product);paths.add(product.url)
   if(product.publicContent.referencePrice)referencePrices++
   if(product.publicContent.descriptionBlocks.length)descriptionBlocks++
   if(product.price!==null)publicPrices++
   if(product.final_online_price!==null&&product.final_online_price!==undefined)onlineFinalPrices++
   if(product.price_provenance==='legacy-hita-pm-approved-2026-11-03')hitaPrices++
   if(product.price_provenance==='legacy-manual-2026-07-02')manualPrices++
   if(product.original_price!==null&&product.original_price!==undefined)verifiedOriginalPrices++
   if(product.publicContent.descriptionHtml)richDescriptions++
   if(product.publicContent.documents?.length)productsWithDocuments++
  }
 }
 if(products.size!==manifest.products||referencePrices!==manifest.contentStats?.referencePrices
   ||descriptionBlocks!==manifest.contentStats?.descriptionBlocks
   ||(restored&&(publicPrices!==manifest.contentStats?.publicPrices||onlineFinalPrices!==manifest.contentStats?.onlineFinalPrices
    ||hitaPrices!==manifest.contentStats?.hitaPrices||manualPrices!==manifest.contentStats?.manualPrices
    ||verifiedOriginalPrices!==manifest.contentStats?.verifiedOriginalPrices
    ||richDescriptions!==manifest.contentStats?.richDescriptions||productsWithDocuments!==manifest.contentStats?.productsWithDocuments
    ||publicPrices!==hitaPrices+manualPrices)))fail('COUNT_MISMATCH')
 if((restored&&manifest.sitemapProductIds===undefined)
   ||(manifest.sitemapProductIds!==undefined
     &&(!Array.isArray(manifest.sitemapProductIds)||manifest.sitemapProductIds.length>products.size
       ||manifest.sitemapProductIds.some((id,index)=>!Number.isSafeInteger(id)||!products.has(id)
         ||(index>0&&id<=manifest.sitemapProductIds[index-1])))))fail('SITEMAP_PRODUCT_IDS')
 let variantProducts=0
 const groups=manifest.variantGroups
 if(!groups||typeof groups!=='object'||Array.isArray(groups))fail('VARIANT_GROUPS_MISSING')
 for(const [key,members] of Object.entries(groups)){
  if(!/^public-[1-9][0-9]*$/.test(key)||!Array.isArray(members)||members.length<2||members.length>8)fail('VARIANT_GROUP_UNSAFE')
  for(const member of members){
   const canonical=products.get(member.id)
   if(!canonical||canonical.variant_group!==key||canonical.url!==member.url
     ||canonical.sku!==member.sku||canonical.variant_label!==member.variant_label
     ||member.price!==canonical.price||member.stock_status!=='contact'||member.publicContent!==undefined)fail('VARIANT_TARGET_UNSAFE')
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
     if(!canonical||canonical.url!==product.url||canonical.price!==product.price
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
 let searchProducts=0
 if(restored){
  if(!Array.isArray(manifest.searchShards)||manifest.searchShards.join(',')!=='0,1,2,3')fail('SEARCH_MANIFEST')
  const seenSearch=new Set()
  for(const shard of manifest.searchShards){
   const asset=await boundedJson(path.join(root,'search',`${shard}.json`))
   if(asset.contract!==manifest.contract||asset.checkpoint!==manifest.checkpoint||!Array.isArray(asset.products))fail('SEARCH_SHARD')
   for(const item of asset.products){
    const canonical=products.get(item.id)
    if(!canonical||seenSearch.has(item.id)||canonical.url!==item.url||canonical.sku!==item.sku
      ||canonical.price!==item.price||canonical.list_price!==item.list_price
      ||canonical.sale_price!==item.sale_price
      ||canonical.final_online_price!==item.final_online_price
      ||JSON.stringify(canonical.product_feature_values)!==JSON.stringify(item.product_feature_values)
      ||JSON.stringify(canonical.colors)!==JSON.stringify(item.colors)
      ||item.id%4!==Number(shard))fail('SEARCH_PRODUCT')
    seenSearch.add(item.id);searchProducts++
   }
  }
  if(searchProducts!==manifest.searchProducts||searchProducts>products.size)fail('SEARCH_COUNT')
 }
 return {status:'PASS',contract:'dpg:preview2-candidate-audit:v1',products:products.size,
  historicalReferencePrices:referencePrices,contactOnlyProducts:products.size-(restored?publicPrices:referencePrices),
  publicPrices,hitaPrices,manualPrices,verifiedOriginalPrices,onlineFinalPrices,richDescriptions,productsWithDocuments,searchProducts,
  descriptionBlockProducts:descriptionBlocks,variantGroups:Object.keys(groups).length,variantProducts,listingCount,listingPages,
  transactionalPrices:restored?'RESTORED_HISTORICAL_PUBLIC':'CONTACT_ONLY',privateFieldsExported:false}
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [, ,buildRoot,output]=process.argv
 if(!buildRoot||!output)fail('ARGUMENT')
 auditPreview2Candidate(buildRoot).then(async proof=>{
  await writeFile(output,JSON.stringify(proof,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify(proof))
 }).catch(error=>{console.error(error.message?.startsWith('PREVIEW2_CANDIDATE_')?error.message:'PREVIEW2_CANDIDATE_FAILED');process.exitCode=1})
}
