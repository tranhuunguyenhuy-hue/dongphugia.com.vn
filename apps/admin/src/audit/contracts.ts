export type AdminAuditEvent = Readonly<{
  id: number
  action: string
  entity_type: string
  entity_id: string
  request_id: string | null
  changed_fields: string[]
  created_at: string
}>

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function parseEvent(value: unknown): AdminAuditEvent | null {
  const row = record(value)
  const id = typeof row?.id === 'number' ? row.id : Number(row?.id)
  const entityId = row?.entity_id
  if (!row || !Number.isSafeInteger(id) || id < 1 ||
    typeof row.action !== 'string' || !row.action || row.action.length > 120 ||
    typeof row.entity_type !== 'string' || !row.entity_type || row.entity_type.length > 80 ||
    !(typeof entityId === 'string' || typeof entityId === 'number') || String(entityId).length > 120 ||
    (row.request_id !== null && row.request_id !== undefined && typeof row.request_id !== 'string') ||
    !Array.isArray(row.changed_fields) || row.changed_fields.length > 40 ||
    row.changed_fields.some((field) => typeof field !== 'string' || field.length > 80) ||
    typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) return null
  return {
    id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: String(entityId),
    request_id: typeof row.request_id === 'string' ? row.request_id : null,
    changed_fields: row.changed_fields as string[],
    created_at: row.created_at,
  }
}

export function parseAdminAuditEvents(value: unknown): AdminAuditEvent[] | null {
  const candidate = record(value)
  if (!candidate || !Array.isArray(candidate.admin)) return null
  const events = candidate.admin.map(parseEvent)
  return events.some((event) => event === null) ? null : events as AdminAuditEvent[]
}
