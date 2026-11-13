import { describe, expect, it, vi } from 'vitest'
import { writePublishingAudit } from './audit'

describe('Publishing audit append query shape', () => {
    it('returns only the generated id without exposing the event history', async () => {
        const create = vi.fn().mockResolvedValue({ id: BigInt(23) })

        await writePublishingAudit({ publishing_audit_events: { create } } as never, {
            actorKind: 'admin',
            identityId: '00000000-0000-4000-8000-000000000001',
            adminActorId: 7,
            action: 'post.cms_updated',
            postId: 41,
            changedFields: ['cms_form'],
        })

        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                actor_kind: 'admin',
                admin_actor_id: 7,
                action: 'post.cms_updated',
                post_id: 41,
                changed_fields: ['cms_form'],
            }),
            select: { id: true },
        }))
    })
})
