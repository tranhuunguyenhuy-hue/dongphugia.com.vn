import { expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { auditPreview2Candidate } from './preview2-candidate-audit.mjs'

it('checks projected real targets and rejects a leaked current price before upload',async()=>{
 const build=await mkdtemp(path.join(tmpdir(),'dpg-preview2-audit-'))
 const root=path.join(build,'assets/__catalogue/v1')
 await mkdir(path.join(root,'products'),{recursive:true})
 const content={summary:'Safe',descriptionBlocks:[{kind:'paragraph',text:'Safe'}],specifications:{},gallery:[],referencePrice:null}
 const product=id=>({id,name:`Product ${id}`,sku:`SKU-${id}`,url:`/thiet-bi-ve-sinh/bon-cau/product-${id}`,
  price:null,price_display:'Liên hệ báo giá',stock_status:'contact',is_promotion:false,variant_options:[],
  variant_group:'public-17',variant_type:'size',variant_label:`Size ${id}`,publicContent:content})
 const products=[product(1),product(2)]
 const manifest={contract:'dpg:public-catalogue-snapshot:v1',contentPolicy:'canonical-public-content-v3',checkpoint:'a'.repeat(40),products:2,
  productBuckets:['aa'],contentStats:{referencePrices:0,descriptionBlocks:2,variantProducts:2},
  variantGroups:{'public-17':products.map(({publicContent,...rest})=>rest)}}
 const asset={contract:manifest.contract,checkpoint:manifest.checkpoint,products}
 try{
  await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest))
  await writeFile(path.join(root,'products/aa.json'),JSON.stringify(asset))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).resolves.toMatchObject({status:'PASS',variantProducts:2,transactionalPrices:'CONTACT_ONLY'})
  await writeFile(path.join(root,'products/aa.json'),JSON.stringify({...asset,products:[{...products[0],price:1200000},products[1]]}))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).rejects.toThrow('PRODUCT_UNSAFE')
  await writeFile(path.join(root,'products/aa.json'),JSON.stringify(asset))
  await writeFile(path.join(root,'manifest.json'),JSON.stringify({...manifest,variantGroups:{'public-17':[{...manifest.variantGroups['public-17'][0],id:99},manifest.variantGroups['public-17'][1]]}}))
  await expect(auditPreview2Candidate(build,{minProducts:2,expectedBuckets:1})).rejects.toThrow('VARIANT_TARGET_UNSAFE')
 }finally{await rm(build,{recursive:true,force:true})}
})
