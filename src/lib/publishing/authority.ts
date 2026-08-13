import type { PublishingTransaction } from './idempotency'

/**
 * Acquires the singleton Gate row before a public-state transition. Callers
 * keep the transaction open through the transition, so a Gate close is
 * linearized before or after publication instead of racing alongside it.
 */
export async function lockPublishingGlobalGateAuthority(
    transaction: PublishingTransaction,
): Promise<void> {
    await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(
            hashtextextended('publishing.global-gate', 0)
        )
    `
}

export async function lockGlobalPublishingGate(
    transaction: PublishingTransaction,
): Promise<boolean> {
    await lockPublishingGlobalGateAuthority(transaction)
    const control = await transaction.publishing_global_controls.findUnique({
        where: { id: 1 },
        select: { publishing_enabled: true },
    })
    return control?.publishing_enabled === true
}
