import {expect,it} from 'vitest'
import {buildSnapshotCategoryRoot} from './public-category-root'

const product=(id:number,slug:string,featured:boolean,brandSlug:string,brandName:string)=>({
  id,name:`Product ${id}`,display_name:`Product ${id}`,slug,sku:`SKU-${id}`,price:null as null,price_display:'Liên hệ báo giá',stock_status:'contact' as const,
  image_main_url:null,is_active:true as const,is_featured:featured,is_promotion:false as const,variant_options:[] as [],
  categories:{name:'Thiết bị bếp',slug:'thiet-bi-bep'},subcategories:{name:'Vòi rửa chén',slug:'voi-rua-chen'},
  brands:{name:brandName,slug:brandSlug},canonical_category_slug:'thiet-bi-bep',canonical_subcategory_slug:'voi-rua-chen',url:`/thiet-bi-bep/voi-rua-chen/${slug}`,
})

it('uses only explicitly featured cards and snapshot brand identities',()=>{
  const products=[product(1,'featured-a',true,'brand-a','Brand A'),product(2,'ordinary',false,'brand-b','Brand B')]
  const root=buildSnapshotCategoryRoot({
    slug:'thiet-bi-bep',name:'Thiết bị bếp',listings:[{slug:'voi-rua-chen',name:'Vòi rửa chén',totalCount:2}],
    homeProducts:products,totalCount:2,
  })
  expect(root?.featuredProducts.map(p=>p.slug)).toEqual(['featured-a'])
  expect(root?.brands.map(b=>b.slug)).toEqual(['brand-a','brand-b'])
  expect(root?.bannerUrl).toBeNull()
  expect(root?.featuredProducts.every(p=>p.price===null&&p.stock_status==='contact')).toBe(true)
})

it('supports multiple selected brands from a bounded per-brand featured set',()=>{
  const products=[
    ...Array.from({length:10},(_,index)=>product(index+1,`brand-a-${index+1}`,true,'brand-a','Brand A')),
    ...Array.from({length:4},(_,index)=>product(index+11,`brand-b-${index+1}`,true,'brand-b','Brand B')),
  ]
  const root=buildSnapshotCategoryRoot({
    slug:'thiet-bi-bep',name:'Thiết bị bếp',listings:[],homeProducts:products.slice(0,8),totalCount:14,
    brands:[{slug:'brand-a',name:'Brand A'},{slug:'brand-b',name:'Brand B'}],featuredProductsByBrand:products,
  },['brand-a','brand-b'])
  expect(root?.isFiltered).toBe(true)
  expect(root?.featuredProducts).toHaveLength(8)
  expect(root?.featuredProducts.every(p=>['brand-a','brand-b'].includes(p.brands?.slug??''))).toBe(true)
  expect(buildSnapshotCategoryRoot({slug:'thiet-bi-bep',name:'Thiết bị bếp',listings:[],homeProducts:products,totalCount:14},['unknown-brand'])).toBeNull()
})
