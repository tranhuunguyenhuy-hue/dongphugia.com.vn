import Sanitary from '@/app/(public)/thiet-bi-ve-sinh/[sub]/page'
import Kitchen from '@/app/(public)/thiet-bi-bep/[sub]/page'
import Water from '@/app/(public)/vat-lieu-nuoc/[sub]/page'
import Tile from '@/app/(public)/gach-op-lat/[sub]/page'
import {notFound} from 'next/navigation'
export const runtime='edge'
export const dynamic='force-dynamic'
export async function generateMetadata({params}:{params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>}) {
 const p=await params
 const {resolveSnapshotRoute}=await import('../../../src/runtime/public-snapshot-catalogue')
 const route=await resolveSnapshotRoute([p.categorySlug,p.subcategorySlug,...(p.productSlug?[p.productSlug]:[])])
 return {title:route.kind==='product'?route.product.name:route.kind==='listing'?route.listing.name:'Không tìm thấy',robots:{index:false,follow:false}}
}
export default async function CanonicalRoute({params,searchParams}: {params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>;searchParams:Promise<Record<string,string>>}) {
 const p=await params
 const query=await searchParams
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
