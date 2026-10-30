import Sanitary from '@/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page'
import Kitchen from '@/app/(public)/thiet-bi-bep/[sub]/[slug]/page'
import Water from '@/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page'
import Tile from '@/app/(public)/gach-op-lat/[sub]/[slug]/page'
import {notFound} from 'next/navigation'
import {buildPreviewRouteMetadata} from '../../../../src/runtime/preview-route-metadata'
export const runtime='edge'
export const dynamic='force-dynamic'
export async function generateMetadata({params}:{params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>}) {
 const p=await params
 const {resolveSnapshotRoute}=await import('../../../../src/runtime/public-snapshot-catalogue')
 const route=await resolveSnapshotRoute([p.categorySlug,p.subcategorySlug,...(p.productSlug?[p.productSlug]:[])])
 const title=route.kind==='product'?route.product.name:route.kind==='listing'?route.listing.name:'Không tìm thấy'
 const canonicalSegments=route.kind==='product'
  ? route.product.url.split('/').filter(Boolean)
  : route.kind==='listing'?[route.category.slug,route.listing.slug]:null
 return canonicalSegments
  ? buildPreviewRouteMetadata(title,canonicalSegments)
  : {title,robots:{index:false,follow:false}}
}
export default async function CanonicalRoute({params,searchParams}: {params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>;searchParams:Promise<Record<string,string>>}) {
 const p=await params
 const props={params:Promise.resolve({sub:p.subcategorySlug,slug:p.productSlug!}),searchParams}
 switch(p.categorySlug){
 case 'thiet-bi-ve-sinh':return Sanitary(props)
 case 'thiet-bi-bep':return Kitchen(props)
 case 'vat-lieu-nuoc':return Water(props)
 case 'gach-op-lat':return Tile(props)
 default:notFound()
 }
}
