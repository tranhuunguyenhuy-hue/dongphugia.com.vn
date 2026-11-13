import { describe, expect, it, vi } from 'vitest'
import { writePimAudit } from './pim-audit'

describe('PIM audit append query shape', () => {
    it('requests only the generated id from an append-only audit insert', async () => {
        const create = vi.fn().mockResolvedValue({ id: 19 })

        await writePimAudit({ audit_logs: { create } }, {
            userId: 7,
            action: 'pim.product_editor.updated',
            entityType: 'product',
            entityId: 123,
            changedFields: ['name'],
        })

        expect(create).toHaveBeenCalledWith({
            data: {
                user_id: 7,
                action: 'pim.product_editor.updated',
                entity_type: 'product',
                entity_id: 123,
                new_value: { changed_fields: ['name'] },
            },
            select: { id: true },
        })
    })
})
