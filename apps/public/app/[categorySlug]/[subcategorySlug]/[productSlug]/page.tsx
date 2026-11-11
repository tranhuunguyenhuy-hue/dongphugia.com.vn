import Sanitary from '@/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page'
import Kitchen from '@/app/(public)/thiet-bi-bep/[sub]/[slug]/page'
import Water from '@/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page'
import Tile from '@/app/(public)/gach-op-lat/[sub]/[slug]/page'
import {notFound} from 'next/navigation'
import {getPublicAppEnvironment} from '../../../../src/config/env'
import {resolvePublicCatalogueRoute} from '../../../../src/runtime/preview-public-catalogue'
import {PreviewSyntheticProductPage} from '../../../../src/runtime/preview-synthetic-pages'
import {isPreviewSyntheticProductRoute, PREVIEW_SYNTHETIC_CATEGORY_SLUG} from '../../../../src/runtime/preview-synthetic-route-contract'
export const runtime='edge'
export const dynamic='force-dynamic'
export async function generateMetadata({params}:{params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>}) {
 const p=await params
 const route=await resolvePublicCatalogueRoute([p.categorySlug,p.subcategorySlug,...(p.productSlug?[p.productSlug]:[])])
 const synthetic=p.categorySlug===PREVIEW_SYNTHETIC_CATEGORY_SLUG
 const indexable=!synthetic&&getPublicAppEnvironment().environment==='production'&&route.kind==='product'
 return {title:route.kind==='product'?route.product.name:route.kind==='listing'?route.listing.name:'Không tìm thấy',alternates:indexable?{canonical:`/${p.categorySlug}/${p.subcategorySlug}/${p.productSlug}`}:undefined,robots:{index:indexable,follow:indexable}}
}
export default async function CanonicalRoute({params,searchParams}: {params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>;searchParams:Promise<Record<string,string>>}) {
 const p=await params
 if(p.categorySlug===PREVIEW_SYNTHETIC_CATEGORY_SLUG){
  if(!isPreviewSyntheticProductRoute(getPublicAppEnvironment().environment,p.categorySlug,p.subcategorySlug,p.productSlug??''))notFound()
  return <PreviewSyntheticProductPage productSlug={p.productSlug!} />
 }
 const props={params:Promise.resolve({sub:p.subcategorySlug,slug:p.productSlug!}),searchParams}
 switch(p.categorySlug){
 case 'thiet-bi-ve-sinh':return Sanitary(props)
 case 'thiet-bi-bep':return Kitchen(props)
 case 'vat-lieu-nuoc':return Water(props)
 case 'gach-op-lat':return Tile(props)
 default:notFound()
 }
}
