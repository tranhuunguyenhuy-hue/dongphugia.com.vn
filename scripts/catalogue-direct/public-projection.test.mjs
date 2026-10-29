import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { projectProduct, buildProjection, safeImage, productBucket } from './public-projection.mjs'
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
 ].map(value=>projectProduct(value,{pdp:true,listing:true},path))
 const built=buildProjection(inputs,evidence,[{slug:'thiet-bi-ve-sinh',name:'Thiết bị vệ sinh',listings:[
  {slug:'empty',name:'Danh mục trống',sortOrder:0,thumbnailUrl:null},
  {slug:'bon-cau',name:'Bồn cầu',sortOrder:10,thumbnailUrl:'https://cdn.hita.com.vn/listing-a.jpg'},
  {slug:'voi-sen',name:'Vòi sen',sortOrder:20,thumbnailUrl:'https://cdn.hita.com.vn/listing-b.jpg'},
 ]}])
 const category=built.manifest.categories[0]
 assert.deepEqual(category.featuredProducts.map(p=>p.slug),['first-brand-a','middle-brand-a','late-brand-b'])
 assert.deepEqual(category.brands,[{slug:'brand-a',name:'Brand A'},{slug:'brand-b',name:'Brand B'}])
 assert.deepEqual(category.featuredProductsByBrand.map(p=>p.slug),['first-brand-a','middle-brand-a','late-brand-b'])
 assert.deepEqual(category.listings.map(l=>l.slug),['empty','bon-cau','voi-sen'])
 assert.equal(category.listings[0].totalCount,0)
 assert.equal(category.listings[1].thumbnail_url,'https://cdn.hita.com.vn/listing-a.jpg')
 assert(!JSON.stringify(built.manifest).includes('rootSortOrder'))
 assert(!JSON.stringify(built.manifest).includes('rootBrandSortOrder'))
})
