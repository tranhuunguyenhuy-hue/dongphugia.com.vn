import {
  callRpc,
  errorResponse,
  handleOptions,
  idempotencyKey,
  integerParam,
  jsonResponse,
  paginationParam,
  readJson,
  requestId,
  requireAuthenticatedClient,
  RuntimeHttpError,
} from '../_shared/runtime.ts'

Deno.serve(async (request) => {
  const request_id = requestId()
  const options = handleOptions(request)
  if (options) return options

  try {
    const { client } = await requireAuthenticatedClient(request)
    const url = new URL(request.url)

    if (request.method === 'GET') {
      const id = url.searchParams.get('id')
      if (id) {
        const data = await callRpc<unknown>(client, 'runtime_quote_get', {
          p_quote_id: integerParam(id, 'INVALID_QUOTE_ID'),
        })
        return data === null ? jsonResponse({ error: { code: 'RESOURCE_NOT_FOUND', request_id } }, 404, request_id)
          : jsonResponse({ data }, 200, request_id)
      }
      const data = await callRpc<unknown>(client, 'runtime_quote_list', {
        p_limit: paginationParam(url.searchParams.get('limit'), 25, 'INVALID_LIMIT', 100),
        p_offset: paginationParam(url.searchParams.get('offset'), 0, 'INVALID_OFFSET', 100000),
      })
      return jsonResponse({ data }, 200, request_id)
    }

    if (request.method === 'POST') {
      const data = await callRpc<unknown>(client, 'runtime_quote_create', {
        p_input: await readJson(request),
        p_idempotency_key: idempotencyKey(request),
        p_request_id: request_id,
      })
      return jsonResponse({ data }, 201, request_id)
    }

    if (request.method === 'PATCH') {
      const body = await readJson(request)
      if (!body || typeof body !== 'object' || !('id' in body) || !('patch' in body)) {
        throw new RuntimeHttpError(400, 'INVALID_INPUT')
      }
      const input = body as { id: unknown; patch: unknown }
      const data = await callRpc<unknown>(client, 'runtime_quote_update', {
        p_quote_id: integerParam(String(input.id), 'INVALID_QUOTE_ID'),
        p_patch: input.patch,
        p_idempotency_key: idempotencyKey(request),
        p_request_id: request_id,
      })
      return data === null ? jsonResponse({ error: { code: 'RESOURCE_NOT_FOUND', request_id } }, 404, request_id)
        : jsonResponse({ data }, 200, request_id)
    }

    if (request.method === 'DELETE') {
      const data = await callRpc<unknown>(client, 'runtime_quote_delete', {
        p_quote_id: integerParam(url.searchParams.get('id'), 'INVALID_QUOTE_ID'),
        p_idempotency_key: idempotencyKey(request),
        p_request_id: request_id,
      })
      return data === null ? jsonResponse({ error: { code: 'RESOURCE_NOT_FOUND', request_id } }, 404, request_id)
        : jsonResponse({ data }, 200, request_id)
    }

    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', request_id } }, 405, request_id)
  } catch (error) {
    return errorResponse(error, request_id)
  }
})
