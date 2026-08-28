import { callRpc,errorResponse,expectedVersion,handleOptions,idempotencyKey,integerParam,jsonResponse,optionalIntegerParam,paginationParam,readJson,requestId,requireAuthenticatedClient,RuntimeHttpError } from '../_shared/runtime.ts'

Deno.serve(async (request) => {
  const request_id=requestId(); const options=handleOptions(request); if(options)return options
  try {
    const {client}=await requireAuthenticatedClient(request); const url=new URL(request.url)
    if(request.method==='GET'){
      const id=url.searchParams.get('id'), external_id=url.searchParams.get('external_id')
      const data=(id||external_id)?await callRpc(client,'leo542_publishing_post_get',{p_post_id:optionalIntegerParam(id,'INVALID_POST_ID'),p_external_id:external_id}):await callRpc(client,'leo542_publishing_post_list',{p_limit:paginationParam(url.searchParams.get('limit'),25,'INVALID_LIMIT',100),p_offset:paginationParam(url.searchParams.get('offset'),0,'INVALID_OFFSET',100000),p_status:url.searchParams.get('status')})
      return jsonResponse({data},data===null?404:200,request_id)
    }
    if(request.method==='PUT'){
      const body=await readJson(request) as {id?:unknown;expected_version?:unknown;input?:unknown}
      if(!body || typeof body!=='object' || !body.input)throw new RuntimeHttpError(400,'INVALID_INPUT')
      const data=await callRpc(client,'leo542_publishing_post_put',{p_post_id:optionalIntegerParam(body.id===undefined?null:String(body.id),'INVALID_POST_ID'),p_expected_version:expectedVersion(request,body.expected_version),p_input:body.input,p_idempotency_key:idempotencyKey(request),p_request_id:request_id})
      return jsonResponse({data},200,request_id)
    }
    return jsonResponse({error:{code:'METHOD_NOT_ALLOWED',request_id}},405,request_id)
  } catch(error){return errorResponse(error,request_id)}
})
