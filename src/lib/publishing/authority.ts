import type { PublishingTransaction } from './idempotency'

/**
 * Acquires the singleton Gate row before a public-state transition. Callers
 * keep the transaction open through the transition, so a Gate close is
 * linearized before or after publication instead of racing alongside it.
 */
export async function lockGlobalPublishingGate(
    transaction: PublishingTransaction,
): Promise<boolean> {
    await transaction.$queryRaw`
        SELECT id FROM publishing_global_controls WHERE id = 1 FOR KEY SHARE
    `
    const control = await transaction.publishing_global_controls.findUnique({
        where: { id: 1 },
        select: { publishing_enabled: true },
    })
    return control?.publishing_enabled === true
}
