// Preview-only data seam for the unchanged canonical family templates.
// Type imports are erased: no Prisma/private database code enters the Worker.
import {cache} from 'react'
import type * as Original from '../../../../src/lib/public-api-products'
export type {VariantSibling,ListingRuntimeConfig} from '../../../../src/lib/public-api-products'
import {getSnapshotCategories,getSnapshotProducts,getSnapshotProduct} from './public-snapshot-catalogue'

const allProducts=cache(async(category:string,sub?:string)=> {
 const c=(await getSnapshotCategories()).find(c=>c.slug===category)
 if(!c)return []
 const result=await Promise.all(c.listings.filter(l=>!sub||l.slug===sub).flatMap(l=>Array.from({length:Math.ceil(l.totalCount/48)},(_,i)=>getSnapshotProducts(category,l.slug,i+1))))
 return result.flatMap(r=>r.products)
})
export const getPublicListingLeaves:typeof Original.getPublicListingLeaves=async(category)=>{
 const c=(await getSnapshotCategories()).find(c=>c.slug===category)
 return (c?.listings??[]).map(l=>({id:null,name:l.name,slug:l.slug,description:null,thumbnail_url:null,source:'legacy' as const,_count:{products:l.totalCount}}))
}
export const getPublicListingLeaf:typeof Original.getPublicListingLeaf=async(category,sub)=>(await getPublicListingLeaves(category)).find(l=>l.slug===sub)??null
export const getListingRuntimeConfig:typeof Original.getListingRuntimeConfig=()=>({profileKey:null,hideColorFilter:true,enableSpecFilters:false,enableProductTypeTabs:false,readyForRefactor:false,relationPriority:['brand']})
export const getAvailableFiltersBySubcategory:typeof Original.getAvailableFiltersBySubcategory=async(sub,_type,category)=>{
 const products=await allProducts(category??'thiet-bi-ve-sinh',sub)
 const brands=Array.from(new Map(products.filter(p=>p.brands).map(p=>[p.brands!.slug,p.brands!])).values())
 return {brands:brands.map(b=>({...b,logo_url:null})),subcategories:(await getPublicListingLeaves(category??'thiet-bi-ve-sinh')).map(l=>({...l,icon_name:null})),materials:[],origins:[],features:[],colors:[]}
}
export const getPublicProducts:typeof Original.getPublicProducts=async(f={})=>{
 let products=await allProducts(f.category_slug??'thiet-bi-ve-sinh',Array.isArray(f.subcategory_slugs)?f.subcategory_slugs[0]:f.subcategory_slugs??f.subcategory_slug)
 if(f.brand_slug)products=products.filter(p=>(Array.isArray(f.brand_slug)?f.brand_slug:f.brand_slug!.split(',')).includes(p.brands?.slug??''))
 if(f.is_featured)products=products.filter(p=>p.is_featured)
 // Missing price/spec/stock are never fabricated or used as a sort key.
 const total=products.length,size=f.pageSize??24,page=f.page??1
 return {products:products.slice((page-1)*size,page*size),total,totalPages:Math.max(1,Math.ceil(total/size)),currentPage:page,page,pageSize:size} as unknown as Awaited<ReturnType<typeof Original.getPublicProducts>>
}
export const getPublicProductBySlug:typeof Original.getPublicProductBySlug=async(category,slug)=>{
 const c=(await getSnapshotCategories()).find(c=>c.slug===category)
 for(const l of c?.listings??[]) {
  const p=await getSnapshotProduct(category,l.slug,slug)
  if(p)return {...p,description:null,features:null,colors:null,product_images:[],product_feature_values:[],variant_group:null,original_price:null,list_price:null,sale_price:null,online_discount_amount:null} as unknown as Awaited<ReturnType<typeof Original.getPublicProductBySlug>>
 }
 return null
}
export const getProductTypeFiltersBySubcategory:typeof Original.getProductTypeFiltersBySubcategory=async()=>[]
export const getSubcategorySpecFilters:typeof Original.getSubcategorySpecFilters=async()=>[]
export const getVariantSiblings:typeof Original.getVariantSiblings=async()=>[]
export const getVariantSelectionData:typeof Original.getVariantSelectionData=async()=>({axes:[],currentVariantOptions:{},siblings:[]})
export const getProductComponents:typeof Original.getProductComponents=async()=>[]
export const getPdpDocuments:typeof Original.getPdpDocuments=()=>[]
export const getPdpSpecifications:typeof Original.getPdpSpecifications=()=>({})
export const getPdpPackageItems:typeof Original.getPdpPackageItems=()=>[]
