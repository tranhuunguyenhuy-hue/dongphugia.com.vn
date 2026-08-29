import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

import {
  LEO553_GITHUB_WORKFLOW_DISPATCH_URL,
  LEO553_GITHUB_WORKFLOW_REF,
  LEO553_PUBLISHING_PARITY_APPROVED,
  parseLeo553BridgeResult,
  parseLeo553Request,
  parseWorkflowDispatchRunId,
  schedulerResponse,
  shouldDispatchPreviewRefresh,
} from '../_shared/leo553.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
})

function publicKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, unknown>
    return typeof keys.default === 'string' && keys.default.length > 0 ? keys.default : null
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)

  const token = request.headers.get('x-publishing-scheduler-token') ?? ''
  if (token.length < 32 || token.length > 256) return json({ error: { code: 'UNAUTHORIZED' } }, 401)

  let input
  try {
    input = parseLeo553Request(await request.json())
  } catch {
    input = null
  }
  if (!input) return json({ error: { code: 'INVALID_REQUEST' } }, 400)

  const key = publicKey()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!key || !supabaseUrl) return json({ error: { code: 'RUNTIME_CONFIGURATION_ERROR' } }, 503)
  if (!LEO553_PUBLISHING_PARITY_APPROVED) {
    return json({
      result_code: 'PUBLISHING_PARITY_UNRESOLVED',
      processed_count: 0,
      published_count: 0,
      blocked_count: 0,
    }, 503)
  }
  const client = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const { data, error } = await client.rpc('leo553_scheduler_bridge', {
    p_run_id: input.run_id,
    p_slot_at: input.slot_at,
    p_scheduler_token: token,
  })
  if (error) {
    console.error(JSON.stringify({ code: 'SCHEDULER_RPC_FAILED', run_id: input.run_id }))
    return json({ error: { code: 'SCHEDULER_OPERATION_FAILED' } }, 500)
  }
  const result = parseLeo553BridgeResult(data)
  if (!result) return json({ error: { code: 'INVALID_SCHEDULER_RESPONSE' } }, 500)
  if (!shouldDispatchPreviewRefresh(result)) return json(schedulerResponse(result))

  const githubToken = Deno.env.get('LEO553_GITHUB_DISPATCH_TOKEN')
  if (!githubToken || githubToken.length < 32) {
    console.error(JSON.stringify({ code: 'REFRESH_CONFIGURATION_BLOCKED', run_id: input.run_id }))
    return json(schedulerResponse(result, 'REFRESH_CONFIGURATION_BLOCKED'), 503)
  }

  const claim = await client.rpc('leo553_claim_preview_refresh', {
    p_run_id: input.run_id,
    p_scheduler_token: token,
  })
  if (claim.error) return json(schedulerResponse(result, 'REFRESH_CLAIM_FAILED'), 500)
  if (claim.data !== true) return json(schedulerResponse(result))

  let dispatchAccepted = false
  let workflowRunId: number | null = null
  try {
    const response = await fetch(LEO553_GITHUB_WORKFLOW_DISPATCH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      body: JSON.stringify({
        ref: LEO553_GITHUB_WORKFLOW_REF,
        inputs: { refresh_id: input.run_id },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 200) {
      workflowRunId = parseWorkflowDispatchRunId(await response.json())
      dispatchAccepted = workflowRunId !== null
    }
  } catch {
    dispatchAccepted = false
  }
  const recorded = await client.rpc('leo553_record_preview_refresh_dispatch', {
    p_run_id: input.run_id,
    p_scheduler_token: token,
    p_accepted: dispatchAccepted,
    p_workflow_run_id: workflowRunId,
  })
  if (recorded.error || recorded.data !== true) {
    console.error(JSON.stringify({ code: 'REFRESH_RESULT_RECORD_FAILED', run_id: input.run_id }))
    return json(schedulerResponse(result, 'REFRESH_RESULT_RECORD_FAILED'), 500)
  }
  if (!dispatchAccepted) {
    console.error(JSON.stringify({ code: 'PREVIEW_REFRESH_DISPATCH_FAILED', run_id: input.run_id }))
    return json(schedulerResponse(result, 'PREVIEW_REFRESH_DISPATCH_FAILED'), 502)
  }
  return json(schedulerResponse(result))
})
