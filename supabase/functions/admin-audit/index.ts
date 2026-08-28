import { callRpc,errorResponse,handleOptions,jsonResponse,paginationParam,requestId,requireAuthenticatedClient } from '../_shared/runtime.ts'

Deno.serve(async (request) => {
  const request_id=requestId(); const options=handleOptions(request); if(options)return options
  try {
    const {client}=await requireAuthenticatedClient(request); const url=new URL(request.url)
    if(request.method==='GET')return jsonResponse({data:await callRpc(client,'leo542_admin_audit_list',{p_limit:paginationParam(url.searchParams.get('limit'),50,'INVALID_LIMIT',100),p_offset:paginationParam(url.searchParams.get('offset'),0,'INVALID_OFFSET',100000)})},200,request_id)
    return jsonResponse({error:{code:'METHOD_NOT_ALLOWED',request_id}},405,request_id)
  } catch(error){return errorResponse(error,request_id)}
})
