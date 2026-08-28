import { callRpc,errorResponse,handleOptions,idempotencyKey,integerParam,jsonResponse,paginationParam,readJson,requestId,requireAuthenticatedClient,RuntimeHttpError } from '../_shared/runtime.ts'

Deno.serve(async (request) => {
  const request_id=requestId(); const options=handleOptions(request); if(options)return options
  try {
    const {client}=await requireAuthenticatedClient(request); const url=new URL(request.url)
    if(request.method==='GET')return jsonResponse({data:await callRpc(client,'leo542_publishing_media_list',{p_limit:paginationParam(url.searchParams.get('limit'),25,'INVALID_LIMIT',100),p_offset:paginationParam(url.searchParams.get('offset'),0,'INVALID_OFFSET',100000)})},200,request_id)
    if(request.method==='POST'){
      const body=await readJson(request) as {post_id?:unknown;media_id?:unknown;usage?:unknown}
      if(!body||typeof body!=='object'||body.post_id===undefined||typeof body.media_id!=='string')throw new RuntimeHttpError(400,'INVALID_INPUT')
      const data=await callRpc(client,'leo542_publishing_media_reference',{p_post_id:integerParam(String(body.post_id),'INVALID_POST_ID'),p_media_id:body.media_id,p_usage:typeof body.usage==='string'?body.usage:'inline',p_idempotency_key:idempotencyKey(request),p_request_id:request_id})
      return jsonResponse({data},200,request_id)
    }
    return jsonResponse({error:{code:'METHOD_NOT_ALLOWED',request_id}},405,request_id)
  } catch(error){return errorResponse(error,request_id)}
})
