'use client'

import {useEffect,useState} from 'react'
import {useSearchParams} from 'next/navigation'
import {useLiveSearchParams} from '../../../../src/components/category/use-live-search-params'
import {ProductCard} from '../../../../src/components/ui/product-card'
import type {SnapshotSearchProduct} from '../../src/runtime/public-snapshot-catalogue'

type SearchResponse={results:SnapshotSearchProduct[];total:number;page:number;limit:number;query:string}

export default function PublicSearchPage(){
 const routerSearch=useSearchParams()
 const params=useLiveSearchParams(routerSearch.toString())
 const query=(params.get('q')??'').trim().slice(0,120)
 const rawPage=Number(params.get('page')??'1')
 const page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1
 const [data,setData]=useState<SearchResponse|null>(null)
 const [error,setError]=useState<string|null>(null)
 useEffect(()=>{
  if(query.length<2)return
  const controller=new AbortController()
  fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=24`,{signal:controller.signal})
   .then(response=>{if(!response.ok)throw new Error('SEARCH_UNAVAILABLE');return response.json() as Promise<SearchResponse>})
   .then(result=>{setData(result);setError(null)})
   .catch(()=>{if(!controller.signal.aborted)setError(`${query}:${page}`)})
  return()=>controller.abort()
 },[query,page])
 return <main className="mx-auto max-w-[1216px] px-4 py-10 min-h-[60vh]">
  <h1 className="text-3xl font-bold mb-6">Tìm kiếm sản phẩm</h1>
  <form action="/tim-kiem" method="get" className="flex gap-3 max-w-2xl mb-8">
   <input key={query} name="q" defaultValue={query} aria-label="Tìm sản phẩm hoặc SKU" placeholder="Tên sản phẩm hoặc mã SKU" className="flex-1 min-w-0 rounded-lg border border-stone-300 px-4 py-3"/>
   <button className="rounded-lg bg-[#2E7A96] text-white px-5 font-semibold">Tìm kiếm</button>
  </form>
  {error===`${query}:${page}`?<p role="alert">Chưa tải được kết quả. Vui lòng thử lại.</p>:query.length<2?<p>Nhập ít nhất hai ký tự để tìm kiếm.</p>:!data||data.query!==query||data.page!==page?<p>Đang tải kết quả…</p>:<>
   <p className="mb-6">{data.total.toLocaleString('vi-VN')} kết quả cho “{query}”</p>
   <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
    {data.results.map(product=><ProductCard key={product.id} product={{...product,display_name:product.name,is_active:true,is_featured:false,is_promotion:product.original_price!==null&&product.price!==null&&product.original_price>product.price,stock_status:'contact',brands:product.brand_name?{name:product.brand_name,slug:''}:null,categories:{name:product.category_slug,slug:product.category_slug},subcategories:{name:product.subcategory_slug,slug:product.subcategory_slug},canonical_category_slug:product.category_slug,canonical_subcategory_slug:product.subcategory_slug,variant_options:[]}} basePath={`/${product.category_slug}`}/>)}
   </div>
   {data.total>24&&<nav className="flex gap-4 justify-center mt-8" aria-label="Trang kết quả">
    {page>1&&<a href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${page-1}`}>Trang trước</a>}
    <span>Trang {page} / {Math.ceil(data.total/24)}</span>
    {page*24<data.total&&<a href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${page+1}`}>Trang sau</a>}
   </nav>}
  </>}
 </main>
}
