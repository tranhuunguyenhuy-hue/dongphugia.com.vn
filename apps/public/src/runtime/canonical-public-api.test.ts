import {describe,it,expect,vi} from 'vitest'
const products=Array.from({length:60},(_,i)=>({id:i,slug:'p-'+i,name:'P'+i,brands:{name:i<50?'A':'B',slug:i<50?'a':'b'},is_featured:false,price:null,stock_status:'contact'}))
vi.mock('./public-snapshot-catalogue',()=>({
 getSnapshotCategories:async()=>[{slug:'thiet-bi-bep',listings:[{slug:'voi-rua-chen',name:'Vòi rửa chén',totalCount:60}]}],
 getSnapshotProducts:async(_c:string,_s:string,page:number)=>({products:products.slice((page-1)*48,page*48)}),
 getSnapshotProduct:async(_category:string,_listing:string,slug:string)=>slug==='public-content'?{id:1,slug,name:'Public product',price:null,stock_status:'contact',publicContent:{summary:'Public summary',descriptionBlocks:[{kind:'heading',text:'Công nghệ'},{kind:'paragraph',text:'Nội dung thực.'}],specifications:{'Công nghệ':'Public technology specification'},gallery:[],referencePrice:{amountVnd:1200000,recordedUpdateDate:'2026-07-02',provenance:'legacy-manual-public-display'}}}:null,
 getSnapshotVariantSiblings:async(group:string,id:number)=>group==='public-17'&&id===1?[{id:2,sku:'SKU-2',slug:'variant-2',name:'Variant 2',url:'/thiet-bi-bep/voi-rua-chen/variant-2',price:1500000,price_display:null,stock_status:'in_stock',is_active:true,image_main_url:'https://cdn.example.invalid/synthetic-size-2.jpg',variant_options:[{axis:'size',value:'Size 2',label:'Size 2'}],variant_group:'public-17',variant_type:'size',variant_label:'Size 2',categories:{slug:'thiet-bi-bep'},subcategories:{slug:'voi-rua-chen'},canonical_category_slug:'thiet-bi-bep',canonical_subcategory_slug:'voi-rua-chen'}]:[],
 getSnapshotVariantSelectionData:async(group:string,id:number)=>group==='public-17'&&id===1?{axes:[{key:'size',label:'Kích thước'}],currentVariantOptions:[{axis:'size',value:'Size 1',label:'Size 1'}],siblings:[{id:2,sku:'SKU-2',slug:'variant-2',name:'Variant 2',url:'/thiet-bi-bep/voi-rua-chen/variant-2',price:1500000,price_display:null,stock_status:'in_stock',is_active:true,image_main_url:'https://cdn.example.invalid/synthetic-size-2.jpg',variant_options:[{axis:'size',value:'Size 2',label:'Size 2'}],variant_group:'public-17',variant_type:'size',variant_label:'Size 2',categories:{slug:'thiet-bi-bep'},subcategories:{slug:'voi-rua-chen'},canonical_category_slug:'thiet-bi-bep',canonical_subcategory_slug:'voi-rua-chen'}]}:{axes:[],currentVariantOptions:[],siblings:[]},
}))
import {getPublicProducts,getAvailableFiltersBySubcategory,getPublicProductBySlug,getPdpSpecifications,getPdpDescriptionBlocks,getPdpHistoricalReferencePrice,getVariantSiblings,getVariantSelectionData} from './canonical-public-api'
describe('canonical Preview public snapshot seam',()=>{
 it('returns the real total for snapshot Listing templates without reading server-side product pages',async()=>{
  const result=await getPublicProducts({category_slug:'thiet-bi-bep',subcategory_slugs:'voi-rua-chen',pageSize:24,page:2})
  expect(result).toMatchObject({products:[],total:60,totalPages:3,page:2,pageSize:24})
 })
 it('filters on the complete listing, then paginates without historic prices',async()=>{
  const result=await getPublicProducts({category_slug:'thiet-bi-bep',subcategory_slug:'voi-rua-chen',brand_slug:'b',pageSize:5,page:2})
  expect(result.total).toBe(10);expect(result.products).toHaveLength(5);expect(result.products[0].id).toBe(55)
  expect(result.products.every(p=>p.price===null&&p.stock_status==='contact')).toBe(true)
 })
 it('offers only public brand identities, with no invented facets or private specs',async()=>{
  const f=await getAvailableFiltersBySubcategory('voi-rua-chen',undefined,'thiet-bi-bep')
  expect(f.brands.map(b=>b.slug)).toEqual(['a','b']);expect(f.materials).toEqual([])
  expect(getPdpSpecifications({} as never)).toEqual({})
  expect(await getPublicProductBySlug('unknown','unknown')).toBeNull()
 })
})

it('returns the sibling with its own canonical URL, price, image, and availability',async()=>{
 const siblings=await getVariantSiblings('public-17',1)
 expect(siblings).toHaveLength(1)
 expect(siblings[0]).toMatchObject({id:2,sku:'SKU-2',url:'/thiet-bi-bep/voi-rua-chen/variant-2',price:1500000,image_main_url:'https://cdn.example.invalid/synthetic-size-2.jpg',stock_status:'in_stock'})
 expect(await getVariantSiblings('public-17',99)).toEqual([])
})

it('supplies verified snapshot axes and each selected product option to the canonical PDP selector',async()=>{
 const data=await getVariantSelectionData('public-17',1)
 expect(data.axes).toEqual([{key:'size',label:'Kích thước'}])
 expect(data.currentVariantOptions).toEqual([{axis:'size',value:'Size 1',label:'Size 1'}])
 expect(data.siblings[0]?.variant_options).toEqual([{axis:'size',value:'Size 2',label:'Size 2'}])
})

it('keeps public technology in specifications without inventing a feature tab',async()=>{
 const product=await getPublicProductBySlug('thiet-bi-bep','public-content')
 expect(product).not.toBeNull()
 expect(getPdpSpecifications(product!)).toEqual({'Công nghệ':'Public technology specification'})
 expect(product?.features).toBeNull()
 expect(product?.description).toBe('<p>Public summary</p>')
 expect(getPdpDescriptionBlocks(product)).toEqual([{kind:'heading',text:'Công nghệ'},{kind:'paragraph',text:'Nội dung thực.'}])
 expect(product?.price).toBeNull()
 expect(product?.stock_status).toBe('contact')
 expect(getPdpHistoricalReferencePrice(product)).toEqual({amountVnd:1200000,recordedUpdateDate:'2026-07-02',provenance:'legacy-manual-public-display'})
})
