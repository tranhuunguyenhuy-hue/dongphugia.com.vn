import {publicSnapshotCheckpoint} from './public-snapshot-mode'

const FAMILIES=['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat']
export const isPrerenderedPath=(path:string)=>['/','/lien-he','/ve-chung-toi'].includes(path)||FAMILIES.some(f=>path===`/${f}`||path.startsWith(`/${f}/`))
export function prerenderRouteKey(url:URL):string|null {
  if(!isPrerenderedPath(url.pathname)||!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/|$))*$/.test(url.pathname))return null
  for(const key of url.searchParams.keys())if(!['page','_rsc','fbclid','gclid'].includes(key)&&!key.startsWith('utm_'))return null
  if(url.searchParams.getAll('page').length>1)return null
  const page=url.searchParams.get('page')
  if(page!==null&&!/^[1-9][0-9]{0,3}$/.test(page))return null
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
