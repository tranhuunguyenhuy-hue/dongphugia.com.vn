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
