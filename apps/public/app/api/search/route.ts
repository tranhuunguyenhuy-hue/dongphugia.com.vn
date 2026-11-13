import { publicPostgresEnabled } from '../../../src/runtime/public-db'
import { searchLiveProducts } from '../../../src/runtime/live-public-catalogue'
import {getSnapshotSearchProducts} from '../../../src/runtime/public-snapshot-catalogue'
import {searchSnapshot} from '../../../src/runtime/snapshot-search'

export async function GET(request:Request){
 const url=new URL(request.url)
 if([...url.searchParams.keys()].some(key=>!['q','page','limit'].includes(key))
   ||['q','page','limit'].some(key=>url.searchParams.getAll(key).length>1))return new Response('Invalid search.',{status:400})
 const q=url.searchParams.get('q')??''
 const pageText=url.searchParams.get('page')??'1'
 const limitText=url.searchParams.get('limit')??'24'
 const page=Number(pageText),limit=Number(limitText)
 if(q.length>120||!/^[1-9][0-9]{0,2}$/.test(pageText)||page>100
   ||!/^[1-9][0-9]?$/.test(limitText)||limit>48)
   return new Response('Invalid search.',{status:400})
 if(q.trim().length<2)return Response.json({results:[],total:0,page,limit,query:q.trim()},{headers:{'Cache-Control':'public, max-age=60'}})
 try{
  const result=publicPostgresEnabled()
    ?await searchLiveProducts(q,page,limit)
    :searchSnapshot(await getSnapshotSearchProducts(),q,page,limit)
  return Response.json(result,{headers:{'Cache-Control':'public, max-age=60'}})
 }catch{return new Response('Search temporarily unavailable.',{status:503,headers:{'Cache-Control':'private, no-store'}})}
}
