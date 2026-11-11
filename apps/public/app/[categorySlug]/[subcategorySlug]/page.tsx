import Sanitary from '@/app/(public)/thiet-bi-ve-sinh/[sub]/page'
import Kitchen from '@/app/(public)/thiet-bi-bep/[sub]/page'
import Water from '@/app/(public)/vat-lieu-nuoc/[sub]/page'
import Tile from '@/app/(public)/gach-op-lat/[sub]/page'
import {notFound} from 'next/navigation'
import {getPublicAppEnvironment} from '../../../src/config/env'
import {resolvePublicCatalogueRoute} from '../../../src/runtime/preview-public-catalogue'
import {PreviewSyntheticListingPage} from '../../../src/runtime/preview-synthetic-pages'
import {isPreviewSyntheticListingRoute, PREVIEW_SYNTHETIC_CATEGORY_SLUG} from '../../../src/runtime/preview-synthetic-route-contract'
export const runtime='edge'
export const dynamic='force-dynamic'
export async function generateMetadata({params}:{params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>}) {
 const p=await params
 const route=await resolvePublicCatalogueRoute([p.categorySlug,p.subcategorySlug,...(p.productSlug?[p.productSlug]:[])])
 const environment=getPublicAppEnvironment().environment
 const synthetic=p.categorySlug===PREVIEW_SYNTHETIC_CATEGORY_SLUG
 const indexable=!synthetic&&environment==='production'&&route.kind!=='not-found'
 return {title:route.kind==='product'?route.product.name:route.kind==='listing'?route.listing.name:'Không tìm thấy',alternates:indexable?{canonical:`/${p.categorySlug}/${p.subcategorySlug}`}:undefined,robots:{index:indexable,follow:indexable}}
}
export default async function CanonicalRoute({params,searchParams}: {params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>;searchParams:Promise<Record<string,string>>}) {
 const p=await params
 const query=await searchParams
 if(p.categorySlug===PREVIEW_SYNTHETIC_CATEGORY_SLUG){
  if(!isPreviewSyntheticListingRoute(getPublicAppEnvironment().environment,p.categorySlug,p.subcategorySlug)||Object.keys(query).length>0)notFound()
  return <PreviewSyntheticListingPage />
 }
 // Reject unsupported filters rather than silently returning misleading results.
 if(Object.keys(query).some(k=>!['page','brand','is_featured'].includes(k)))notFound()
 const props={params:Promise.resolve({sub:p.subcategorySlug,slug:p.productSlug!}),searchParams:Promise.resolve(query)}
 switch(p.categorySlug){
 case 'thiet-bi-ve-sinh':return Sanitary(props)
 case 'thiet-bi-bep':return Kitchen(props)
 case 'vat-lieu-nuoc':return Water(props)
 case 'gach-op-lat':return Tile(props)
 default:notFound()
 }
}
