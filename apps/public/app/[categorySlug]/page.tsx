import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CategoryRootView } from '@/components/category/category-root-view'
import { getSnapshotCategoryRoot } from '../../src/runtime/public-snapshot-catalogue'
import { usesPublicSnapshot } from '../../src/runtime/public-snapshot-mode'
import { getPreviewCatalogueCategories, getPreviewCatalogueProducts } from '../../src/runtime/preview-public-catalogue'
import { buildSnapshotCategoryRoot } from '../../src/runtime/public-category-root'
import { getPublicAppEnvironment } from '../../src/config/env'
import { isPreviewSyntheticCategoryRoute, PREVIEW_SYNTHETIC_CATEGORY_SLUG } from '../../src/runtime/preview-synthetic-route-contract'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const CATEGORY_TITLES:Record<string,string>={
  'thiet-bi-ve-sinh':'Thiết Bị Vệ Sinh',
  'thiet-bi-bep':'Thiết Bị Bếp',
  'vat-lieu-nuoc':'Vật Liệu Nước',
  'gach-op-lat':'Gạch Ốp Lát',
  'preview-synthetic':'Sản phẩm thử nghiệm',
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
  const environment=getPublicAppEnvironment().environment
  const synthetic=categorySlug===PREVIEW_SYNTHETIC_CATEGORY_SLUG
  const indexable=!synthetic&&environment==='production'
  return title
    ? {title,alternates:synthetic?undefined:{canonical:`/${categorySlug}`},robots:{index:indexable,follow:indexable}}
    : {title:'Không tìm thấy danh mục',robots:{index:false,follow:false}}
}

export default async function PublicCategoryPage({params,searchParams}:PageProps){
  const [{categorySlug},query]=await Promise.all([params,searchParams])
  if(categorySlug===PREVIEW_SYNTHETIC_CATEGORY_SLUG
    &&!isPreviewSyntheticCategoryRoute(getPublicAppEnvironment().environment,categorySlug))notFound()
  const unsupported=Object.keys(query).some(key=>key!=='brands'&&!TRACKING_KEYS.has(key)&&!key.startsWith('utm_'))
  const rawBrand=query.brands
  const brandSlugs=rawBrand===undefined?[]:typeof rawBrand==='string'?rawBrand.split(','):[]
  if(unsupported||(rawBrand!==undefined&&(
    typeof rawBrand!=='string'||brandSlugs.length===0||brandSlugs.some(brandSlug=>!SLUG.test(brandSlug))||new Set(brandSlugs).size!==brandSlugs.length
  )))notFound()

  // The prerendered root asset is shared by every valid brand selection. Keep
  // its server props independent of the URL; snapshot filters activate after
  // hydration so HTML, Flight and browser history agree without route combos.
  const root=usesPublicSnapshot()
    ? await getSnapshotCategoryRoot(categorySlug)
    : await (async()=>{
      const category=(await getPreviewCatalogueCategories()).find(c=>c.slug===categorySlug)
      if(!category)return null
      const listings=await Promise.all(category.listings.map(async listing=>({
        ...listing,
        totalCount:(await getPreviewCatalogueProducts(categorySlug,listing.slug)).length,
      })))
      const homeProducts=(await Promise.all(category.listings.map(listing=>
        getPreviewCatalogueProducts(categorySlug,listing.slug)))).flat()
      return buildSnapshotCategoryRoot({
        slug:category.slug,name:category.name,listings,homeProducts,totalCount:homeProducts.length,
      })
    })()
  if(!root||brandSlugs.some(slug=>!root.brands.some(brand=>brand.slug===slug)))notFound()
  return <CategoryRootView {...root} filterMode="snapshot" />
}
