import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CategoryRootView } from '@/components/category/category-root-view'
import { getSnapshotCategoryRoot } from '../../src/runtime/public-snapshot-catalogue'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const CATEGORY_TITLES:Record<string,string>={
  'thiet-bi-ve-sinh':'Thiết Bị Vệ Sinh',
  'thiet-bi-bep':'Thiết Bị Bếp',
  'vat-lieu-nuoc':'Vật Liệu Nước',
  'gach-op-lat':'Gạch Ốp Lát',
}
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TRACKING_KEYS=new Set(['_rsc','fbclid','gclid'])

type SearchParams=Record<string,string|string[]|undefined>
type PageProps={
  params:Promise<{categorySlug:string}>
  searchParams:Promise<SearchParams>
}

export async function generateMetadata({params}:PageProps):Promise<Metadata>{
  const {categorySlug}=await params
  const title=CATEGORY_TITLES[categorySlug]
  return title
    ? {title,robots:{index:false,follow:false}}
    : {title:'Không tìm thấy danh mục',robots:{index:false,follow:false}}
}

export default async function PublicCategoryPage({params,searchParams}:PageProps){
  const [{categorySlug},query]=await Promise.all([params,searchParams])
  const unsupported=Object.keys(query).some(key=>key!=='brands'&&!TRACKING_KEYS.has(key)&&!key.startsWith('utm_'))
  const rawBrand=query.brands
  const brandSlugs=rawBrand===undefined?[]:typeof rawBrand==='string'?rawBrand.split(','):[]
  if(unsupported||(rawBrand!==undefined&&(
    typeof rawBrand!=='string'||brandSlugs.length===0||brandSlugs.some(brandSlug=>!SLUG.test(brandSlug))||new Set(brandSlugs).size!==brandSlugs.length
  )))notFound()

  const root=await getSnapshotCategoryRoot(categorySlug,brandSlugs)
  if(!root)notFound()
  return <CategoryRootView {...root} filterMode="snapshot" />
}
