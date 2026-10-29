import {describe,it,expect,vi} from 'vitest'
const products=Array.from({length:60},(_,i)=>({id:i,slug:'p-'+i,name:'P'+i,brands:{name:i<50?'A':'B',slug:i<50?'a':'b'},is_featured:false,price:null,stock_status:'contact'}))
vi.mock('./public-snapshot-catalogue',()=>({
 getSnapshotCategories:async()=>[{slug:'thiet-bi-bep',listings:[{slug:'voi-rua-chen',name:'Vòi rửa chén',totalCount:60}]}],
 getSnapshotProducts:async(_c:string,_s:string,page:number)=>({products:products.slice((page-1)*48,page*48)}),
 getSnapshotProduct:async()=>null,
}))
import {getPublicProducts,getAvailableFiltersBySubcategory,getPublicProductBySlug,getPdpSpecifications} from './canonical-public-api'
describe('canonical Preview public snapshot seam',()=>{
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
