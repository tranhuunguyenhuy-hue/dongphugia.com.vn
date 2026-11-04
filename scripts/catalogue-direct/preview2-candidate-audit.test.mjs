import { expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { auditPreview2Candidate } from './preview2-candidate-audit.mjs'
import {projectProduct,buildProjection} from './public-projection.mjs'
import {projectPublicContent} from './public-product-content.mjs'

it('checks projected real targets and rejects a leaked current price before upload',async()=>{
 const build=await mkdtemp(path.join(tmpdir(),'dpg-preview2-audit-'))
 const root=path.join(build,'assets/__catalogue/v1')
 await mkdir(path.join(root,'products'),{recursive:true})
 const content={summary:'Safe',descriptionBlocks:[{kind:'paragraph',text:'Safe'}],specifications:{},gallery:[],referencePrice:null}
 const product=id=>({id,name:`Product ${id}`,sku:`SKU-${id}`,url:`/thiet-bi-ve-sinh/bon-cau/product-${id}`,
  categories:{slug:'thiet-bi-ve-sinh',name:'Thiết bị vệ sinh'},subcategories:{slug:'bon-cau',name:'Bồn cầu'},
  price:null,price_display:'Liên hệ báo giá',stock_status:'contact',is_promotion:false,variant_options:[],
  variant_group:'public-17',variant_type:'size',variant_label:`Size ${id}`,publicContent:content})
 const products=[product(1),product(2)]
 const manifest={contract:'dpg:public-catalogue-snapshot:v1',contentPolicy:'canonical-public-content-v3',checkpoint:'a'.repeat(40),products:2,
  productBuckets:['aa'],sitemapProductIds:[1],listingProducts:2,categories:[{slug:'thiet-bi-ve-sinh',listings:[{slug:'bon-cau',totalCount:2}]}],contentStats:{referencePrices:0,descriptionBlocks:2,variantProducts:2},
  variantGroups:{'public-17':products.map(({publicContent,...rest})=>rest)}}
 const asset={contract:manifest.contract,checkpoint:manifest.checkpoint,products}
 try{
  await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest))
  await writeFile(path.join(root,'products/aa.json'),JSON.stringify(asset))
  await mkdir(path.join(root,'listings/thiet-bi-ve-sinh/bon-cau'),{recursive:true})
  await writeFile(path.join(root,'listings/thiet-bi-ve-sinh/bon-cau/1.json'),JSON.stringify({contract:manifest.contract,checkpoint:manifest.checkpoint,page:1,totalCount:2,products}))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).resolves.toMatchObject({status:'PASS',variantProducts:2,listingCount:2,listingPages:1,transactionalPrices:'CONTACT_ONLY'})
  await writeFile(path.join(root,'manifest.json'),JSON.stringify({...manifest,sitemapProductIds:[1,99]}))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).rejects.toThrow('SITEMAP_PRODUCT_IDS')
  await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest))
  await writeFile(path.join(root,'listings/thiet-bi-ve-sinh/bon-cau/1.json'),JSON.stringify({contract:manifest.contract,checkpoint:manifest.checkpoint,page:1,totalCount:2,products:[products[0],products[0]]}))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).rejects.toThrow('LISTING_PRODUCT')
  await writeFile(path.join(root,'listings/thiet-bi-ve-sinh/bon-cau/1.json'),JSON.stringify({contract:manifest.contract,checkpoint:manifest.checkpoint,page:1,totalCount:2,products}))
  await writeFile(path.join(root,'products/aa.json'),JSON.stringify({...asset,products:[{...products[0],price:1200000},products[1]]}))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).rejects.toThrow('PRODUCT_UNSAFE')
  await writeFile(path.join(root,'products/aa.json'),JSON.stringify(asset))
  await writeFile(path.join(root,'manifest.json'),JSON.stringify({...manifest,variantGroups:{'public-17':[{...manifest.variantGroups['public-17'][0],id:99},manifest.variantGroups['public-17'][1]]}}))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).rejects.toThrow('VARIANT_TARGET_UNSAFE')
 }finally{await rm(build,{recursive:true,force:true})}
})
it('audits a restored-price snapshot across PDP, listing and search shards',async()=>{
 const build=await mkdtemp(path.join(tmpdir(),'dpg-preview4-audit-'))
 const root=path.join(build,'assets/__catalogue/v1')
 const row={id:1,name:'Bồn cầu kiểm thử',slug:'bon-cau-kiem-thu',sku:'MS636DT2#XW',price:21223200,
  original_price:26529000,list_price:26529000,sale_price:21223200,online_discount_amount:3183000,
  price_updated_at:new Date('2026-07-02T00:00:00Z'),price_source:'hita',source_system:'hita',price_state:'priced',price_confidence:'high',
  image_main_url:null,is_featured:false,brand_name:'TOTO',brand_slug:'toto',publicDescription:'<p>Thông tin chung</p>'}
 const canonical={categorySlug:'thiet-bi-ve-sinh',subcategorySlug:'bon-cau',categoryName:'Thiết bị vệ sinh',subcategoryName:'Bồn cầu',taxonomyException:null}
 const product={...projectProduct(row,{pdp:true,listing:true,search:true},canonical,{restoreCommerce:true}),publicContent:projectPublicContent(row,{rich:true})}
 const {manifest,assets}=buildProjection([product],{checkpoint:'a'.repeat(40),m3CodeSha:'b'.repeat(40),m3RunId:'123'},[],{restoreCommerce:true})
 try{
  for(const [name,value] of assets){const dest=path.join(root,name);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,JSON.stringify(value))}
  await expect(auditPreview2Candidate(build,{minProducts:1,expectedBuckets:1})).resolves.toMatchObject({publicPrices:1,onlineFinalPrices:1,searchProducts:1,transactionalPrices:'RESTORED_HISTORICAL_PUBLIC'})
  const search=assets.get('search/1.json')
  await writeFile(path.join(root,'search/1.json'),JSON.stringify({...search,products:[{...search.products[0],final_online_price:1}]}))
  await expect(auditPreview2Candidate(build,{minProducts:1,expectedBuckets:1})).rejects.toThrow('SEARCH_PRODUCT')
 }finally{await rm(build,{recursive:true,force:true})}
})
