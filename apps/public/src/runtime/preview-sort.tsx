'use client'

import {usePathname,useSearchParams} from 'next/navigation'
import {notifySearchParamsChange,useLiveSearchParams} from '@/components/category/use-live-search-params'

export function CategorySort(){
 const pathname=usePathname()
 const routerSearch=useSearchParams()
 const search=useLiveSearchParams(routerSearch.toString())
 const sort=search.get('sort')??'default'
 return <label className="text-[11px] text-neutral-600">
  <span className="sr-only">Sắp xếp sản phẩm</span>
  <select aria-label="Sắp xếp sản phẩm" value={sort} onChange={event=>{
   const next=new URLSearchParams(search.toString())
   if(event.target.value==='default')next.delete('sort')
   else next.set('sort',event.target.value)
   next.set('page','1')
   window.history.pushState(null,'',`${pathname}?${next}`)
   notifySearchParamsChange()
  }} className="h-8 rounded-md border border-neutral-300 bg-white px-2">
   <option value="default">Sắp xếp mặc định</option>
   <option value="price-asc">Giá tăng dần</option>
   <option value="price-desc">Giá giảm dần</option>
  </select>
 </label>
}
