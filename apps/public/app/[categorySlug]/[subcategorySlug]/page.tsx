import Sanitary from '@/app/(public)/thiet-bi-ve-sinh/[sub]/page'
import Kitchen from '@/app/(public)/thiet-bi-bep/[sub]/page'
import Water from '@/app/(public)/vat-lieu-nuoc/[sub]/page'
import Tile from '@/app/(public)/gach-op-lat/[sub]/page'
import {notFound} from 'next/navigation'
import {getPublicAppEnvironment} from '../../../src/config/env'
import {publicPostgresEnabled} from '../../../src/runtime/public-db'
import {getLiveListingRouteMetadata} from '../../../src/runtime/live-public-catalogue'
import {publicRouteFailureSummary} from '../../../src/runtime/public-route-diagnostics'
export const runtime='edge'
export const dynamic='force-dynamic'
const SAFE_SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
function reportListingFailure(categorySlug:string,subcategorySlug:string,stage:'metadata'|'render',error:unknown) {
 if(process.env.PUBLIC_DB_DIAGNOSTICS!=='true')return
 console.error(JSON.stringify({
  event:'PUBLIC_LISTING_ROUTE_FAILURE',stage,
  categorySlug:SAFE_SLUG.test(categorySlug)?categorySlug:'invalid',
  subcategorySlug:SAFE_SLUG.test(subcategorySlug)?subcategorySlug:'invalid',
  ...publicRouteFailureSummary(error),
 }))
}
export async function generateMetadata({params}:{params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>}) {
 const p=await params
 try {
  if(publicPostgresEnabled()&&!p.productSlug){
   const listing=await getLiveListingRouteMetadata(p.categorySlug,p.subcategorySlug)
   const indexable=getPublicAppEnvironment().environment==='production'&&listing!==null
   return {title:listing?.listingName??'Không tìm thấy',alternates:indexable?{canonical:`/${p.categorySlug}/${p.subcategorySlug}`}:undefined,robots:{index:indexable,follow:indexable}}
  }
  const {resolveSnapshotRoute}=await import('../../../src/runtime/public-snapshot-catalogue')
  const route=await resolveSnapshotRoute([p.categorySlug,p.subcategorySlug,...(p.productSlug?[p.productSlug]:[])])
  const indexable=getPublicAppEnvironment().environment==='production'&&route.kind!=='not-found'
  return {title:route.kind==='product'?route.product.name:route.kind==='listing'?route.listing.name:'Không tìm thấy',alternates:indexable?{canonical:`/${p.categorySlug}/${p.subcategorySlug}`}:undefined,robots:{index:indexable,follow:indexable}}
 } catch(error) {
  reportListingFailure(p.categorySlug,p.subcategorySlug,'metadata',error)
  throw error
 }
}
export default async function CanonicalRoute({params,searchParams}: {params:Promise<{categorySlug:string;subcategorySlug:string;productSlug?:string}>;searchParams:Promise<Record<string,string>>}) {
 const p=await params
 const query=await searchParams
 // Reject unsupported filters rather than silently returning misleading results.
 if(Object.keys(query).some(k=>!['page','brand','is_featured'].includes(k)))notFound()
 const props={params:Promise.resolve({sub:p.subcategorySlug,slug:p.productSlug!}),searchParams:Promise.resolve(query)}
 try {
  switch(p.categorySlug){
  case 'thiet-bi-ve-sinh':return await Sanitary(props)
  case 'thiet-bi-bep':return await Kitchen(props)
  case 'vat-lieu-nuoc':return await Water(props)
  case 'gach-op-lat':return await Tile(props)
  default:notFound()
  }
 } catch(error) {
  reportListingFailure(p.categorySlug,p.subcategorySlug,'render',error)
  throw error
 }
}
