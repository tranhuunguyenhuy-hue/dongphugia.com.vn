export const LEO553_GITHUB_WORKFLOW_DISPATCH_URL =
  'https://api.github.com/repos/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/workflows/preview-publishing-refresh.yml/dispatches'
export const LEO553_GITHUB_WORKFLOW_REF = 'main'
export const LEO553_PUBLISHING_PARITY_APPROVED = false

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type Leo553Request = {
  source: 'leo543'
  run_id: string
  slot_at: string
}

export type Leo553BridgeResult = {
  result_code: 'SUCCESS' | 'WRITE_FREEZE_ACTIVE'
  processed_count: number
  published_count: number
  blocked_count: number
  refresh_required: boolean
}

export function parseLeo553Request(value: unknown): Leo553Request | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.source !== 'leo543' || typeof record.run_id !== 'string' || !UUID.test(record.run_id)) return null
  if (typeof record.slot_at !== 'string') return null
  const slot = new Date(record.slot_at)
  if (!Number.isFinite(slot.getTime())) return null
  return { source: 'leo543', run_id: record.run_id, slot_at: slot.toISOString() }
}

function boundedCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 100
    ? Number(value)
    : null
}

export function parseLeo553BridgeResult(value: unknown): Leo553BridgeResult | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.result_code !== 'SUCCESS' && record.result_code !== 'WRITE_FREEZE_ACTIVE') return null
  const processed = boundedCount(record.processed_count)
  const published = boundedCount(record.published_count)
  const blocked = boundedCount(record.blocked_count)
  if (processed === null || published === null || blocked === null) return null
  if (published + blocked > processed || typeof record.refresh_required !== 'boolean') return null
  return {
    result_code: record.result_code,
    processed_count: processed,
    published_count: published,
    blocked_count: blocked,
    refresh_required: record.refresh_required,
  }
}

export function schedulerResponse(result: Leo553BridgeResult, resultCode: string = result.result_code) {
  return {
    result_code: resultCode,
    processed_count: result.processed_count,
    published_count: result.published_count,
    blocked_count: result.blocked_count,
  }
}

export function shouldDispatchPreviewRefresh(result: Leo553BridgeResult): boolean {
  return result.refresh_required && result.published_count > 0
}

export function parseWorkflowDispatchRunId(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const runId = (value as Record<string, unknown>).workflow_run_id
  return Number.isSafeInteger(runId) && Number(runId) > 0 ? Number(runId) : null
}
