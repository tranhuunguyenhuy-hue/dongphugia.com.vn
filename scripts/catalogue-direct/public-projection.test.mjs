import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { projectProduct, buildProjection, safeImage, productBucket, ROOTS } from './public-projection.mjs'
import { prerender, renderPaths } from './prerender-public-snapshot.mjs'
const input={id:1,name:'Sản phẩm minh họa kiểm thử',slug:'synthetic-only',sku:'SYNTHETIC',image_main_url:'https://cdn.hita.com.vn/example.jpg',brand_name:'Synthetic Brand',brand_slug:'synthetic-brand',price:'123456',source_url:'private-marker',customer_email:'secret-marker',specs:{internal:'secret-marker'},is_featured:false}
const path={categorySlug:'thiet-bi-ve-sinh',subcategorySlug:'bon-cau',categoryName:'Thiết bị vệ sinh',subcategoryName:'Bồn cầu',taxonomyException:null}
const evidence={checkpoint:'a'.repeat(40),m3CodeSha:'b'.repeat(40),m3RunId:'123'}
describe('synthetic mechanism only: public snapshot projection',()=>{
  it('excludes ineligible products and does not serialize historic prices/private fields',()=>{
    assert.equal(projectProduct(input,{pdp:false,listing:false},path),null)
    assert.equal(projectProduct(input,{pdp:true,listing:true},{...path,taxonomyException:'multiple_primary_assignments'}),null)
    const dto=projectProduct(input,{pdp:true,listing:true},path)
    assert.equal(dto.price,null);assert.equal(dto.stock_status,'contact')
    assert(!JSON.stringify(dto).includes('secret-marker'))
    assert(!JSON.stringify(dto).includes('private-marker'))
    assert(!JSON.stringify(dto).includes('123456'))
    const built=buildProjection([dto],evidence)
    assert.equal(built.manifest.listingProducts,1)
    assert(!JSON.stringify([...built.assets.values()]).includes('listingEligible'))
    assert(built.assets.has('products/'+productBucket(dto.url)+'.json'))
  })
  it('keeps PDP-only products out of category/home/listing projections',()=>{
    const dto=projectProduct(input,{pdp:true,listing:false},path)
    const built=buildProjection([dto],evidence)
    assert.equal(built.manifest.products,1)
    assert.equal(built.manifest.listingProducts,0)
    assert.deepEqual(built.manifest.categories,[])
  })
  it('rejects path collisions, missing proof and unsafe image protocols/hosts',()=>{
    const dto=projectProduct(input,{pdp:true,listing:true},path)
    assert.throws(()=>buildProjection([dto,dto],evidence),/DUPLICATE/)
    assert.throws(()=>buildProjection([{...dto,source_url:'private-marker'}],evidence),/UNSAFE_DTO/)
    assert.throws(()=>buildProjection([dto],{}),/EVIDENCE/)
    for(const url of ['/images/a?token=private','/images/%2e%2e/private','javascript:alert(1)','https://evil.test/image.jpg','https://user:password@cdn.hita.com.vn/a','https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/sign/private?a=1']) assert.equal(safeImage(url),null)
  })
})
it('keeps reviewed content on PDP assets only and rejects nested private fields',()=>{
 const dto=projectProduct(input,{pdp:true,listing:true},path)
 const content={summary:null,specifications:{'Chất liệu':'Sứ'},gallery:['https://cdn.dongphugia.com.vn/a.jpg']}
 const built=buildProjection([{...dto,publicContent:content}],evidence)
 const pdp=built.assets.get('products/'+productBucket(dto.url)+'.json').products[0]
 assert.deepEqual(pdp.publicContent,content)
 assert.equal(built.manifest.categories[0].homeProducts[0].publicContent,undefined)
 assert.equal(built.assets.get('listings/thiet-bi-ve-sinh/bon-cau/1.json').products[0].publicContent,undefined)
 assert.throws(()=>buildProjection([{...dto,publicContent:{...content,raw_html:'private'}}],evidence),/UNSAFE_CONTENT/)
})
it('projects truthful category brands and a bounded featured set per brand',()=>{
 const products=Array.from({length:10},(_,index)=>projectProduct({
  ...input,id:index+1,slug:`product-${index+1}`,brand_name:index<9?'Synthetic Brand':'Other Brand',brand_slug:index<9?'synthetic-brand':'other-brand',is_featured:index!==8,
  rootBrandId:index<9?1:2,rootBrandSortOrder:index<9?1:2,
 },{pdp:true,listing:true},path))
 const built=buildProjection(products,evidence)
 const category=built.manifest.categories[0]
 assert.deepEqual(category.brands,[{slug:'synthetic-brand',name:'Synthetic Brand'},{slug:'other-brand',name:'Other Brand'}])
 assert.equal(category.featuredProductsByBrand.filter(p=>p.brands?.slug==='synthetic-brand').length,8)
 assert.equal(category.featuredProductsByBrand.filter(p=>p.brands?.slug==='other-brand').length,1)
 assert(category.featuredProductsByBrand.every(p=>p.is_featured&&p.price===null&&p.stock_status==='contact'))
 assert(!JSON.stringify(category).includes('listingEligible'))
})
it('keeps category roots in canonical product, brand and listing order without leaking sort metadata',()=>{
 const inputs=[
  {...input,id:1,slug:'late-brand-b',brand_name:'Brand B',brand_slug:'brand-b',is_featured:true,rootSortOrder:30,rootBrandId:2,rootBrandSortOrder:20,rootSubcategorySortOrder:20,rootSubcategoryThumbnailUrl:'https://cdn.hita.com.vn/listing-b.jpg'},
  {...input,id:2,slug:'middle-brand-a',brand_name:'Brand A',brand_slug:'brand-a',is_featured:true,rootSortOrder:20,rootBrandId:1,rootBrandSortOrder:10,rootSubcategorySortOrder:10,rootSubcategoryThumbnailUrl:'https://cdn.hita.com.vn/listing-a.jpg'},
  {...input,id:3,slug:'first-brand-a',brand_name:'Brand A',brand_slug:'brand-a',is_featured:true,rootSortOrder:10,rootBrandId:1,rootBrandSortOrder:10,rootSubcategorySortOrder:20,rootSubcategoryThumbnailUrl:'https://cdn.hita.com.vn/listing-b.jpg'},
 ].map(value=>projectProduct(
  value,
  {pdp:true,listing:true},
  value.slug==='late-brand-b'?{...path,subcategorySlug:'voi-sen',subcategoryName:'Vòi sen'}:path,
 ))
 const built=buildProjection(inputs,evidence,[{slug:'thiet-bi-ve-sinh',name:'Thiết bị vệ sinh',listings:[
  {slug:'empty',name:'Danh mục trống',sortOrder:0,thumbnailUrl:null},
  {slug:'bon-cau',name:'Bồn cầu',sortOrder:10,thumbnailUrl:'https://cdn.hita.com.vn/listing-a.jpg'},
  {slug:'voi-sen',name:'Vòi sen',sortOrder:20,thumbnailUrl:'https://cdn.hita.com.vn/listing-b.jpg'},
 ]}])
 const category=built.manifest.categories[0]
 assert.deepEqual(category.featuredProducts.map(p=>p.slug),['first-brand-a','middle-brand-a','late-brand-b'])
 assert.deepEqual(category.brands,[{slug:'brand-a',name:'Brand A'},{slug:'brand-b',name:'Brand B'}])
 assert.deepEqual(category.featuredProductsByBrand.map(p=>p.slug),['first-brand-a','middle-brand-a','late-brand-b'])
 assert.deepEqual(category.listings.map(l=>l.slug),['bon-cau','voi-sen'])
 assert.deepEqual(category.listings.map(l=>l.totalCount),[2,1])
 assert.equal(category.listings[0].thumbnail_url,'https://cdn.hita.com.vn/listing-a.jpg')
 assert.equal(category.listings[1].thumbnail_url,'https://cdn.hita.com.vn/listing-b.jpg')
 assert(!JSON.stringify(built.manifest).includes('rootSortOrder'))
 assert(!JSON.stringify(built.manifest).includes('rootBrandSortOrder'))
})

it('keeps empty roots, removes zero-product leaves and prerenders the projected manifest',async()=>{
 const rootMetadata=ROOTS.map((slug,index)=>({
  slug,
  name:`Category ${slug}`,
  listings:[
   {slug:'empty-leaf',name:'Empty leaf',sortOrder:1,thumbnailUrl:null},
   ...(index===0?[{slug:'bon-cau',name:'Bồn cầu',sortOrder:10,thumbnailUrl:'https://cdn.hita.com.vn/bon-cau.jpg'}]:[]),
  ],
 }))
 const dto=projectProduct({...input,is_featured:true},{pdp:true,listing:true},path)
 const {manifest,assets}=buildProjection([dto],evidence,rootMetadata)

 assert.equal(manifest.products,1)
 assert.equal(manifest.listingProducts,1)
 assert.deepEqual(manifest.categories.map(category=>category.slug),ROOTS)
 assert.equal(manifest.categories[0].totalCount,1)
 assert.deepEqual(manifest.categories[0].listings.map(listing=>({slug:listing.slug,totalCount:listing.totalCount})),[{slug:'bon-cau',totalCount:1}])
 assert(manifest.categories.slice(1).every(category=>category.totalCount===0&&category.listings.length===0))
 assert.equal(assets.size,3)
 assert(assets.has('manifest.json'))
 assert(assets.has(`products/${productBucket(dto.url)}.json`))
 assert(assets.has('listings/thiet-bi-ve-sinh/bon-cau/1.json'))

 const productAssets=[...assets.entries()]
  .filter(([name])=>name.startsWith('products/'))
  .flatMap(([,asset])=>asset.products)
 const paths=renderPaths(manifest,productAssets)
 assert(paths.length<9000)
 for(const root of ROOTS)assert(paths.includes(`/${root}`))
 assert(paths.includes('/thiet-bi-ve-sinh/bon-cau'))
 assert(paths.includes(dto.url))
 for(const root of ROOTS)assert(!paths.some(path=>path.startsWith(`/${root}/empty-leaf`)))

 const invalidManifest={
  ...manifest,
  categories:manifest.categories.map((category,index)=>index===0
   ?{...category,listings:[{slug:'empty-leaf',totalCount:0}]}
   :category),
 }
 assert.throws(()=>renderPaths(invalidManifest,[]),/RENDER_LISTING/)

 const tempRoot=await mkdtemp(join(tmpdir(),'dpg-projection-prerender-'))
 try{
  const assetsRoot=join(tempRoot,'assets'),checkpointRoot=join(tempRoot,'render')
  for(const [name,value] of assets){
   const filePath=join(assetsRoot,'__catalogue/v1',name)
   await mkdir(dirname(filePath),{recursive:true})
   await writeFile(filePath,JSON.stringify(value),{mode:0o600})
  }
  const requested=[]
  const fetchImpl=async(input)=>{
   const url=new URL(input)
   if(url.pathname==='/api/health')return new Response(null,{status:200,headers:{'x-dpg-source-sha':'c'.repeat(40)}})
   requested.push(url.pathname+url.search)
   return new Response('<html><body><h1>Synthetic canonical renderer</h1></body></html>',{status:200,headers:{'content-type':'text/html; charset=utf-8','x-dpg-source-sha':'c'.repeat(40)}})
  }
  const expectedPaths=renderPaths(manifest,productAssets)
  const proof=await prerender({
   assetsRoot,checkpointRoot,baseUrl:'http://127.0.0.1:8790',sourceSha:'c'.repeat(40),checkpoint:evidence.checkpoint,
   concurrency:1,fetchImpl,extractFlight:()=>new TextEncoder().encode('0:{"public":true}\n'),
  })
  assert.equal(proof.status,'COMPLETE')
  assert.equal(proof.routes,expectedPaths.length)
  assert.equal(proof.products,1)
  assert.deepEqual(requested.sort(),[...expectedPaths].sort())
  assert(requested.includes('/thiet-bi-ve-sinh/bon-cau'))
  for(const root of ROOTS)assert(requested.includes(`/${root}`))
  for(const root of ROOTS)assert(!requested.some(path=>path.startsWith(`/${root}/empty-leaf`)))
  const ready=JSON.parse(await readFile(join(checkpointRoot,'v1','c'.repeat(40),evidence.checkpoint,'ready.json'),'utf8'))
  assert.equal(ready.status,'COMPLETE')
 }finally{
  await rm(tempRoot,{recursive:true,force:true})
 }
})
