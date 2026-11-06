import { describe, expect, it } from 'vitest'

import { parseAdminAuditEvents } from './contracts'

describe('Admin audit transport contract', () => {
  it('keeps only valid actor-safe audit fields for display', () => {
    expect(parseAdminAuditEvents({ admin: [{
      id: 7, user_id: 99, action: 'phase2.order.status.updated', entity_type: 'order', entity_id: '27',
      request_id: '00000000-0000-4000-8000-000000000001', changed_fields: ['status'], created_at: '2026-11-06T10:00:00Z',
    }] })).toEqual([{
      id: 7, action: 'phase2.order.status.updated', entity_type: 'order', entity_id: '27',
      request_id: '00000000-0000-4000-8000-000000000001', changed_fields: ['status'], created_at: '2026-11-06T10:00:00Z',
    }])
  })

  it('fails closed for missing, malformed, or oversized audit records', () => {
    expect(parseAdminAuditEvents(null)).toBeNull()
    expect(parseAdminAuditEvents({ admin: [{ id: 0 }] })).toBeNull()
    expect(parseAdminAuditEvents({ admin: [{ id: 1, action: 'x'.repeat(121) }] })).toBeNull()
  })
})
