import {publicSnapshotCheckpoint} from './public-snapshot-mode'

const FAMILIES=['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat']
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SNAPSHOT_CONTRACT='dpg:public-catalogue-snapshot:v1'
const SNAPSHOT_MANIFEST_URL='https://catalogue-assets.invalid/__catalogue/v1/manifest.json'
export const isPrerenderedPath=(path:string)=>['/','/lien-he','/ve-chung-toi'].includes(path)||FAMILIES.some(f=>path===`/${f}`||path.startsWith(`/${f}/`))

function isRecord(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function snapshotRootBrands(value:unknown,checkpoint:string,categorySlug:string):Set<string>|null{
  if(!isRecord(value)||value.contract!==SNAPSHOT_CONTRACT||value.checkpoint!==checkpoint
    ||!Array.isArray(value.categories)||value.categories.length!==FAMILIES.length)return null
  const seenCategories=new Set<string>(),rootBrands=new Map<string,Set<string>>()
  for(const category of value.categories){
    if(!isRecord(category)||typeof category.slug!=='string'||!FAMILIES.includes(category.slug)
      ||seenCategories.has(category.slug)||!Array.isArray(category.brands))return null
    seenCategories.add(category.slug)
    const brands=new Set<string>()
    for(const brand of category.brands){
      if(!isRecord(brand)||typeof brand.slug!=='string'||!SLUG.test(brand.slug)
        ||typeof brand.name!=='string'||!brand.name.trim()||brands.has(brand.slug))return null
      brands.add(brand.slug)
    }
    rootBrands.set(category.slug,brands)
  }
  if(seenCategories.size!==FAMILIES.length)return null
  return rootBrands.get(categorySlug)??null
}
export function prerenderRouteKey(url:URL):string|null {
  if(!isPrerenderedPath(url.pathname)||!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/|$))*$/.test(url.pathname))return null
  const isCategoryRoot=FAMILIES.some(f=>url.pathname===`/${f}`)
  const brands=url.searchParams.getAll('brands')
  if(brands.length>1)return null
  const selectedBrands=brands.length===1?brands[0].split(','):[]
  if(brands.length===1&&(!isCategoryRoot||selectedBrands.length===0||selectedBrands.length>20||selectedBrands.some(brand=>!SLUG.test(brand))||new Set(selectedBrands).size!==selectedBrands.length))return null
  for(const key of url.searchParams.keys())if(!['page','brands','_rsc','fbclid','gclid'].includes(key)&&!key.startsWith('utm_'))return null
  if(url.searchParams.getAll('page').length>1)return null
  const page=url.searchParams.get('page')
  if(page!==null&&!/^[1-9][0-9]{0,3}$/.test(page))return null
  if(isCategoryRoot&&page!==null)return null
  // Every brand selection shares the same immutable root asset. The hydrated
  // snapshot UI applies the bounded filterable products to the browser URL.
  if(isCategoryRoot)return url.pathname
  return url.pathname+(page&&page!=='1'?`?page=${page}`:'')
}
export async function servePrerenderedCatalogue(request:Request,environment:Record<string,unknown>,sourceSha:string):Promise<Response|null>{
  const url=new URL(request.url),checkpoint=publicSnapshotCheckpoint()
  if(!checkpoint||!isPrerenderedPath(url.pathname))return null
  // Build-only loopback renderer; this variable is never in the publication config.
  if(environment.CATALOGUE_BUILD_RENDER==='true'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return null
  const headers=new Headers({'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-DPG-Source-SHA':sourceSha,'Vary':'RSC, Accept-Encoding'})
  const stop=(status:number,message:string)=>new Response(message,{status,headers})
  if(!['GET','HEAD'].includes(request.method))return stop(405,'Method not allowed.')
  const key=prerenderRouteKey(url)
  if(!key)return stop(400,'Tham số duyệt sản phẩm chưa được hỗ trợ.')
  const assets=environment.ASSETS as {fetch?:(url:string)=>Promise<Response>}|undefined
  const prefix=`https://catalogue-assets.invalid/__render/v1/${sourceSha}/${checkpoint}/`
  const ready=await assets?.fetch?.(prefix+'ready.json')
  if(!ready?.ok)return stop(503,'Catalogue temporarily unavailable.')
  const proof=await ready.json() as {sourceSha?:string;checkpoint?:string;status?:string}
  if(proof.sourceSha!==sourceSha||proof.checkpoint!==checkpoint||proof.status!=='COMPLETE')return stop(503,'Catalogue temporarily unavailable.')
  if(url.searchParams.has('brands')){
    let manifestResponse:Response|undefined,manifestBody:unknown
    try{
      manifestResponse=await assets?.fetch?.(SNAPSHOT_MANIFEST_URL)
      if(!manifestResponse?.ok)return stop(503,'Catalogue temporarily unavailable.')
      const text=await manifestResponse.text()
      if(text.length>2_000_000)return stop(503,'Catalogue temporarily unavailable.')
      manifestBody=JSON.parse(text)
    }catch{return stop(503,'Catalogue temporarily unavailable.')}
    const brands=snapshotRootBrands(manifestBody,checkpoint,url.pathname.slice(1))
    if(!brands)return stop(503,'Catalogue temporarily unavailable.')
    const selected=url.searchParams.get('brands')!.split(',')
    if(selected.some(brand=>!brands.has(brand)))return stop(404,'Không tìm thấy trang.')
  }
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(b=>b.toString(16).padStart(2,'0')).join('')
  const flight=request.headers.get('RSC')==='1'
  const asset=await assets!.fetch!(prefix+digest+(flight?'.rsc.gz':'.html.gz'))
  if(!asset.ok)return stop(asset.status===404?404:503,asset.status===404?'Không tìm thấy trang.':'Catalogue temporarily unavailable.')
  headers.set('Content-Type',flight?'text/x-component; charset=utf-8':'text/html; charset=utf-8')
  headers.set('X-DPG-Render','PRERENDER')
  const gzip=(request.headers.get('Accept-Encoding')??'').split(',').some(p=>/^\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?(?:\s|$))[^,]+)?\s*$/i.test(p))
  if(gzip)headers.set('Content-Encoding','gzip')
  const body=request.method==='HEAD'?null:gzip?asset.body:asset.body?.pipeThrough(new DecompressionStream('gzip'))
  return new Response(body,{status:200,headers,...(gzip?{encodeBody:'manual' as const}:{})})
}
