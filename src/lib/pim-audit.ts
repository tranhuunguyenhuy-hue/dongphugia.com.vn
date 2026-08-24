import type { Prisma } from '@prisma/client'

/**
 * Write a minimized CMS/PIM audit event. Values are intentionally omitted:
 * Product specs and descriptions can contain arbitrary catalogue content and
 * the audit trail is for provenance, not a second data store.
 */
export async function writePimAudit(
  tx: unknown,
  input: {
    userId: number
    action: string
    entityType: string
    entityId?: number | null
    changedFields: string[]
  },
) {
  const client = tx as { audit_logs: { create: (args: { data: Prisma.audit_logsUncheckedCreateInput }) => Promise<unknown> } }
  await client.audit_logs.create({
    data: {
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      new_value: {
        changed_fields: input.changedFields,
      },
    },
  })
}
