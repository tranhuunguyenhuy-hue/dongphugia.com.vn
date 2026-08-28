import { callRpc,errorResponse,handleOptions,idempotencyKey,integerParam,jsonResponse,paginationParam,readJson,requestId,requireAuthenticatedClient,RuntimeHttpError } from '../_shared/runtime.ts'

Deno.serve(async (request) => {
  const request_id=requestId(); const options=handleOptions(request); if(options)return options
  try {
    const {client}=await requireAuthenticatedClient(request); const url=new URL(request.url)
    const resource=url.searchParams.get('resource') ?? 'orders'
    if(request.method==='GET'){
      const id=url.searchParams.get('id')
      const data=id
        ? await callRpc(client,'leo542_admin_commerce_get',{p_resource:resource,p_id:integerParam(id,'INVALID_RESOURCE_ID')})
        : await callRpc(client,'leo542_admin_commerce_list',{p_resource:resource,p_limit:paginationParam(url.searchParams.get('limit'),25,'INVALID_LIMIT',100),p_offset:paginationParam(url.searchParams.get('offset'),0,'INVALID_OFFSET',100000)})
      return jsonResponse({data},data===null?404:200,request_id)
    }
    if(request.method==='PATCH'){
      const body=await readJson(request) as {id?:unknown;patch?:unknown}
      if(!body || typeof body!=='object' || body.id===undefined || body.patch===undefined)throw new RuntimeHttpError(400,'INVALID_INPUT')
      const data=await callRpc(client,'leo542_admin_commerce_patch',{p_resource:resource,p_id:integerParam(String(body.id),'INVALID_RESOURCE_ID'),p_patch:body.patch,p_idempotency_key:idempotencyKey(request),p_request_id:request_id})
      return jsonResponse({data},200,request_id)
    }
    return jsonResponse({error:{code:'METHOD_NOT_ALLOWED',request_id}},405,request_id)
  } catch(error){return errorResponse(error,request_id)}
})
