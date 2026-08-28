import { callRpc,errorResponse,expectedVersion,handleOptions,idempotencyKey,integerParam,jsonResponse,optionalIntegerParam,paginationParam,readJson,requestId,requireAuthenticatedClient,RuntimeHttpError } from '../_shared/runtime.ts'

Deno.serve(async (request) => {
  const request_id=requestId(); const options=handleOptions(request); if(options)return options
  try {
    const {client}=await requireAuthenticatedClient(request); const url=new URL(request.url)
    if(request.method==='GET'){
      const id=url.searchParams.get('id')
      const data=id?await callRpc(client,'leo542_admin_product_get',{p_product_id:integerParam(id,'INVALID_PRODUCT_ID')}):await callRpc(client,'leo542_admin_product_list',{p_limit:paginationParam(url.searchParams.get('limit'),25,'INVALID_LIMIT',100),p_offset:paginationParam(url.searchParams.get('offset'),0,'INVALID_OFFSET',100000),p_publication_status:url.searchParams.get('publication_status')})
      return jsonResponse({data},data===null?404:200,request_id)
    }
    if(request.method==='POST'||request.method==='PATCH'){
      const body=await readJson(request) as {id?:unknown;expected_version?:unknown;input?:unknown}
      if(!body || typeof body!=='object' || !body.input)throw new RuntimeHttpError(400,'INVALID_INPUT')
      const data=await callRpc(client,'leo542_admin_product_put',{p_product_id:optionalIntegerParam(body.id===undefined?null:String(body.id),'INVALID_PRODUCT_ID'),p_expected_version:expectedVersion(request,body.expected_version),p_input:body.input,p_idempotency_key:idempotencyKey(request),p_request_id:request_id})
      return jsonResponse({data},request.method==='POST'?201:200,request_id)
    }
    return jsonResponse({error:{code:'METHOD_NOT_ALLOWED',request_id}},405,request_id)
  } catch(error){return errorResponse(error,request_id)}
})
