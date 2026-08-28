import { callRpc,errorResponse,handleOptions,idempotencyKey,integerParam,jsonResponse,readJson,requestId,requireAuthenticatedClient,RuntimeHttpError } from '../_shared/runtime.ts'

Deno.serve(async (request) => {
  const request_id=requestId(); const options=handleOptions(request); if(options)return options
  try {
    const {client}=await requireAuthenticatedClient(request)
    if(request.method==='GET')return jsonResponse({data:await callRpc(client,'leo542_admin_content_snapshot',{})},200,request_id)
    if(request.method==='PATCH'){
      const body=await readJson(request) as {resource?:unknown;id?:unknown;patch?:unknown}
      if(!body||typeof body!=='object'||typeof body.resource!=='string'||body.id===undefined||body.patch===undefined)throw new RuntimeHttpError(400,'INVALID_INPUT')
      const data=await callRpc(client,'leo542_admin_content_patch',{p_resource:body.resource,p_id:integerParam(String(body.id),'INVALID_RESOURCE_ID'),p_patch:body.patch,p_idempotency_key:idempotencyKey(request),p_request_id:request_id})
      return jsonResponse({data},200,request_id)
    }
    return jsonResponse({error:{code:'METHOD_NOT_ALLOWED',request_id}},405,request_id)
  } catch(error){return errorResponse(error,request_id)}
})
