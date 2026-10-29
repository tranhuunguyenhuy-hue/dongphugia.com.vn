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

  // The prerendered root asset is shared by every valid brand selection. Keep
  // its server props independent of the URL; snapshot filters activate after
  // hydration so HTML, Flight and browser history agree without route combos.
  const root=await getSnapshotCategoryRoot(categorySlug)
  if(!root||brandSlugs.some(slug=>!root.brands.some(brand=>brand.slug===slug)))notFound()
  return <CategoryRootView {...root} filterMode="snapshot" />
}
