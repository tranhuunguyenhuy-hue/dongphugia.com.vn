import { isIP } from 'node:net'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const projectRequire = createRequire(import.meta.url)
const prisma = projectRequire('../../src/lib/prisma.ts').default as typeof import('../../src/lib/prisma.ts').default
const {
    generatePublishingCredential,
    PUBLISHING_CAPABILITIES,
} = projectRequire('../../src/lib/publishing/auth.ts') as typeof import('../../src/lib/publishing/auth.ts')
const { writePublishingAudit } = projectRequire('../../src/lib/publishing/audit.ts') as typeof import('../../src/lib/publishing/audit.ts')

type PublishingCapability = 'posts:write' | 'posts:publish' | 'media:write'
type PublishingEnvironment = 'staging' | 'production'

class ControlInputError extends Error {}

type Flags = Map<string, string>

function parseFlags(values: string[]): Flags {
    const flags = new Map<string, string>()
    for (let index = 0; index < values.length; index += 1) {
        const key = values[index]
        if (!key.startsWith('--')) {
            throw new ControlInputError(`Unexpected argument: ${key}`)
        }
        const value = values[index + 1]
        if (!value || value.startsWith('--')) {
            throw new ControlInputError(`Missing value for ${key}`)
        }
        flags.set(key.slice(2), value)
        index += 1
    }
    return flags
}

function required(flags: Flags, name: string): string {
    const value = flags.get(name)
    if (!value) throw new ControlInputError(`--${name} is required`)
    return value
}

function integer(flags: Flags, name: string): number {
    const value = Number(required(flags, name))
    if (!Number.isInteger(value) || value < 1) {
        throw new ControlInputError(`--${name} must be a positive integer`)
    }
    return value
}

function uuid(flags: Flags, name: string): string {
    const value = required(flags, name)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new ControlInputError(`--${name} must be a UUID`)
    }
    return value
}

function environment(flags: Flags): PublishingEnvironment {
    const value = required(flags, 'environment')
    if (value !== 'staging' && value !== 'production') {
        throw new ControlInputError('--environment must be staging or production')
    }
    return value
}

function capability(flags: Flags): PublishingCapability {
    const value = required(flags, 'capability')
    if (!PUBLISHING_CAPABILITIES.includes(value as PublishingCapability)) {
        throw new ControlInputError('--capability is not recognized')
    }
    return value as PublishingCapability
}

function capabilities(flags: Flags): PublishingCapability[] {
    const values = required(flags, 'capabilities').split(',').map((value) => value.trim())
    const unique = [...new Set(values)]
    if (!unique.length || unique.some((value) => !PUBLISHING_CAPABILITIES.includes(value as PublishingCapability))) {
        throw new ControlInputError('--capabilities must be a comma-separated Publishing capability list')
    }
    return unique as PublishingCapability[]
}

function requireConfirmedMutation(flags: Flags): void {
    if (flags.get('confirm') !== 'yes') {
        throw new ControlInputError('Mutating commands require --confirm yes')
    }
}

async function requireAdminActor(flags: Flags): Promise<number> {
    const id = integer(flags, 'actor-admin-id')
    const actor = await prisma.admin_users.findFirst({
        where: { id, is_active: true, role: 'admin' },
        select: { id: true },
    })
    if (!actor) {
        throw new ControlInputError('--actor-admin-id must identify an active admin user')
    }
    return actor.id
}

async function requireSponsor(id: number): Promise<void> {
    const sponsor = await prisma.admin_users.findFirst({
        where: { id, is_active: true },
        select: { id: true },
    })
    if (!sponsor) {
        throw new ControlInputError('--sponsor-user-id must identify an active staff user')
    }
}

function expiresAt(now: Date, flags: Flags): Date {
    const rawDays = flags.get('expires-in-days')
    const days = rawDays ? Number(rawDays) : 90
    if (!Number.isInteger(days) || days < 1 || days > 90) {
        throw new ControlInputError('--expires-in-days must be an integer from 1 to 90')
    }
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

function output(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`)
}

async function lockIdentityControlRows(
    transaction: typeof prisma,
    identityId: string,
    options: { credentials?: boolean; capabilities?: boolean; ipAllowlist?: boolean } = {},
) {
    await transaction.$queryRaw`
        SELECT id FROM publishing_machine_identities WHERE id = ${identityId}::uuid FOR UPDATE
    `
    if (options.credentials) {
        await transaction.$queryRaw`
            SELECT id FROM publishing_credentials WHERE identity_id = ${identityId}::uuid FOR UPDATE
        `
    }
    if (options.capabilities) {
        await transaction.$queryRaw`
            SELECT capability FROM publishing_identity_capabilities
            WHERE identity_id = ${identityId}::uuid FOR UPDATE
        `
    }
    if (options.ipAllowlist) {
        await transaction.$queryRaw`
            SELECT ip_address FROM publishing_identity_ip_allowlist
            WHERE identity_id = ${identityId}::uuid FOR UPDATE
        `
    }
}

async function createIdentity(flags: Flags) {
    requireConfirmedMutation(flags)
    const actorId = await requireAdminActor(flags)
    const sponsorId = integer(flags, 'sponsor-user-id')
    await requireSponsor(sponsorId)
    const name = required(flags, 'name').trim()
    if (!name || name.length > 120) {
        throw new ControlInputError('--name must contain 1 to 120 characters')
    }
    const identityId = randomUUID()
    const granted = capabilities(flags)
    const now = new Date()
    await prisma.$transaction(async (transaction) => {
        await transaction.publishing_machine_identities.create({
            data: { id: identityId, name, sponsor_user_id: sponsorId },
        })
        await transaction.publishing_identity_capabilities.createMany({
            data: granted.map((capability) => ({
                identity_id: identityId,
                capability,
                granted_at: now,
            })),
        })
        await writePublishingAudit(transaction, {
            actorKind: 'admin',
            identityId,
            adminActorId: actorId,
            sponsorUserId: sponsorId,
            action: 'identity.created',
            changedFields: ['name', 'sponsor_user_id', 'capabilities'],
            metadata: { capability_count: granted.length },
            now,
        })
    })
    output({ identity_id: identityId, name, capabilities: granted })
}

async function setIdentityActive(flags: Flags, active: boolean) {
    requireConfirmedMutation(flags)
    const actorId = await requireAdminActor(flags)
    const identityId = uuid(flags, 'identity-id')
    const now = new Date()
    const reason = active ? null : required(flags, 'reason').slice(0, 300)
    const identity = await prisma.publishing_machine_identities.findUnique({
        where: { id: identityId },
        select: { sponsor_user_id: true },
    })
    if (!identity) throw new ControlInputError('Machine Identity was not found')
    await prisma.$transaction(async (transaction) => {
        await lockIdentityControlRows(transaction, identityId)
        await transaction.publishing_machine_identities.update({
            where: { id: identityId },
            data: {
                is_active: active,
                disabled_at: active ? null : now,
                disabled_reason: reason,
                updated_at: now,
            },
        })
        await writePublishingAudit(transaction, {
            actorKind: 'admin',
            identityId,
            adminActorId: actorId,
            sponsorUserId: identity.sponsor_user_id,
            action: active ? 'identity.enabled' : 'identity.disabled',
            changedFields: ['is_active'],
            metadata: active ? undefined : { reason },
            now,
        })
    })
    output({ identity_id: identityId, is_active: active })
}

async function setCapability(flags: Flags, grant: boolean) {
    requireConfirmedMutation(flags)
    const actorId = await requireAdminActor(flags)
    const identityId = uuid(flags, 'identity-id')
    const selected = capability(flags)
    const identity = await prisma.publishing_machine_identities.findUnique({
        where: { id: identityId },
        select: { sponsor_user_id: true },
    })
    if (!identity) throw new ControlInputError('Machine Identity was not found')
    const now = new Date()
    await prisma.$transaction(async (transaction) => {
        await lockIdentityControlRows(transaction, identityId, { capabilities: true })
        if (grant) {
            await transaction.publishing_identity_capabilities.upsert({
                where: { identity_id_capability: { identity_id: identityId, capability: selected } },
                create: { identity_id: identityId, capability: selected, granted_at: now },
                update: { revoked_at: null, granted_at: now },
            })
        } else {
            const result = await transaction.publishing_identity_capabilities.updateMany({
                where: { identity_id: identityId, capability: selected, revoked_at: null },
                data: { revoked_at: now },
            })
            if (result.count !== 1) throw new ControlInputError('Capability is not currently active')
        }
        await writePublishingAudit(transaction, {
            actorKind: 'admin',
            identityId,
            adminActorId: actorId,
            sponsorUserId: identity.sponsor_user_id,
            action: grant ? 'capability.granted' : 'capability.revoked',
            changedFields: ['capability'],
            metadata: { capability: selected },
            now,
        })
    })
    output({ identity_id: identityId, capability: selected, active: grant })
}

async function setIpAllowlist(flags: Flags, add: boolean) {
    requireConfirmedMutation(flags)
    const actorId = await requireAdminActor(flags)
    const identityId = uuid(flags, 'identity-id')
    const ip = required(flags, 'ip-address')
    if (!isIP(ip)) throw new ControlInputError('--ip-address must be an IPv4 or IPv6 address')
    const identity = await prisma.publishing_machine_identities.findUnique({
        where: { id: identityId },
        select: { sponsor_user_id: true },
    })
    if (!identity) throw new ControlInputError('Machine Identity was not found')
    const now = new Date()
    await prisma.$transaction(async (transaction) => {
        await lockIdentityControlRows(transaction, identityId, { ipAllowlist: true })
        if (add) {
            await transaction.publishing_identity_ip_allowlist.upsert({
                where: { identity_id_ip_address: { identity_id: identityId, ip_address: ip } },
                create: { identity_id: identityId, ip_address: ip, created_at: now },
                update: {},
            })
        } else {
            await transaction.publishing_identity_ip_allowlist.deleteMany({
                where: { identity_id: identityId, ip_address: ip },
            })
        }
        await writePublishingAudit(transaction, {
            actorKind: 'admin',
            identityId,
            adminActorId: actorId,
            sponsorUserId: identity.sponsor_user_id,
            action: add ? 'ip_allowlist.added' : 'ip_allowlist.removed',
            changedFields: ['ip_allowlist'],
            metadata: { ip_address: ip },
            now,
        })
    })
    output({ identity_id: identityId, ip_address: ip, allowed: add })
}

async function issueCredential(flags: Flags, rotating = false) {
    requireConfirmedMutation(flags)
    const actorId = await requireAdminActor(flags)
    const identityId = uuid(flags, 'identity-id')
    const targetEnvironment = environment(flags)
    const now = new Date()
    const credential = generatePublishingCredential(targetEnvironment)
    const expiry = expiresAt(now, flags)
    const previousId = rotating ? uuid(flags, 'from-credential-id') : null
    const record = await prisma.$transaction(async (transaction) => {
        await lockIdentityControlRows(transaction, identityId, { credentials: true })
        const identity = await transaction.publishing_machine_identities.findUnique({
            where: { id: identityId },
            select: { sponsor_user_id: true, is_active: true },
        })
        if (!identity?.is_active) throw new ControlInputError('Machine Identity must be active')
        const activeCredentials = await transaction.publishing_credentials.findMany({
            where: {
                identity_id: identityId,
                revoked_at: null,
                expires_at: { gt: now },
            },
            select: { id: true, expires_at: true, environment: true },
        })
        const activeForEnvironment = activeCredentials.filter(
            ({ environment }) => environment === targetEnvironment,
        )
        if (!rotating && activeForEnvironment.length > 0) {
            throw new ControlInputError('Use credential-rotate while an active credential exists for this environment')
        }
        if (!rotating && activeCredentials.length >= 2) {
            throw new ControlInputError('A Machine Identity can have at most two active credentials')
        }
        let previous: { id: string; expires_at: Date } | undefined
        if (rotating) {
            previous = activeForEnvironment.find(({ id }) => id === previousId)
            if (!previous || activeForEnvironment.length !== 1) {
                throw new ControlInputError('Rotation requires exactly one active source credential for this environment')
            }
            if (activeCredentials.length >= 2) {
                throw new ControlInputError('A Machine Identity can have at most two active credentials')
            }
        }
        await transaction.publishing_credentials.create({
            data: {
                id: credential.id,
                identity_id: identityId,
                token_prefix: credential.tokenPrefix,
                token_hash: credential.tokenHash,
                environment: targetEnvironment,
                issued_at: now,
                expires_at: expiry,
                rotated_from_credential_id: previous?.id,
            },
        })
        if (previous) {
            const overlapEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            await transaction.publishing_credentials.update({
                where: { id: previous.id },
                data: { expires_at: previous.expires_at < overlapEnds ? previous.expires_at : overlapEnds },
            })
        }
        await writePublishingAudit(transaction, {
            actorKind: 'admin',
            identityId,
            adminActorId: actorId,
            sponsorUserId: identity.sponsor_user_id,
            action: rotating ? 'credential.rotated' : 'credential.issued',
            changedFields: ['credential'],
            metadata: {
                credential_id: credential.id,
                environment: targetEnvironment,
                expires_at: expiry.toISOString(),
            },
            now,
        })
        return identity
    })
    // The plaintext credential exists only in this process and is printed once.
    output({
        credential_id: credential.id,
        identity_id: identityId,
        environment: targetEnvironment,
        expires_at: expiry.toISOString(),
        credential: credential.token,
        sponsor_user_id: record.sponsor_user_id,
    })
}

async function revokeCredential(flags: Flags) {
    requireConfirmedMutation(flags)
    const actorId = await requireAdminActor(flags)
    const credentialId = uuid(flags, 'credential-id')
    const reason = required(flags, 'reason').slice(0, 300)
    const now = new Date()
    const credential = await prisma.publishing_credentials.findUnique({
        where: { id: credentialId },
        include: { identity: { select: { sponsor_user_id: true } } },
    })
    if (!credential) throw new ControlInputError('Publishing Credential was not found')
    await prisma.$transaction(async (transaction) => {
        await lockIdentityControlRows(transaction, credential.identity_id, { credentials: true })
        await transaction.publishing_credentials.update({
            where: { id: credentialId },
            data: { revoked_at: now, revoke_reason: reason },
        })
        await writePublishingAudit(transaction, {
            actorKind: 'admin',
            identityId: credential.identity_id,
            adminActorId: actorId,
            sponsorUserId: credential.identity.sponsor_user_id,
            action: 'credential.revoked',
            changedFields: ['credential'],
            metadata: { credential_id: credentialId, reason },
            now,
        })
    })
    output({ credential_id: credentialId, revoked: true })
}

async function setGlobalGate(flags: Flags) {
    requireConfirmedMutation(flags)
    const actorId = await requireAdminActor(flags)
    const enabled = required(flags, 'enabled')
    if (enabled !== 'true' && enabled !== 'false') {
        throw new ControlInputError('--enabled must be true or false')
    }
    const expectedVersion = integer(flags, 'expected-version')
    const now = new Date()
    const result = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
            SELECT id FROM publishing_global_controls WHERE id = 1 FOR UPDATE
        `
        const updated = await transaction.publishing_global_controls.updateMany({
            where: { id: 1, version: expectedVersion },
            data: {
                publishing_enabled: enabled === 'true',
                version: { increment: 1 },
                updated_at: now,
                updated_by_user_id: actorId,
            },
        })
        if (updated.count !== 1) throw new ControlInputError('Global Publishing Gate version is stale or uninitialized')
        await writePublishingAudit(transaction, {
            actorKind: 'admin',
            adminActorId: actorId,
            action: 'global_gate.changed',
            changedFields: ['publishing_enabled'],
            metadata: { enabled: enabled === 'true', from_version: expectedVersion },
            now,
        })
        return expectedVersion + 1
    })
    output({ publishing_enabled: enabled === 'true', version: result })
}

async function expiryReport(flags: Flags) {
    const withinDays = flags.get('within-days') ? integer(flags, 'within-days') : 14
    const until = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000)
    const credentials = await prisma.publishing_credentials.findMany({
        where: { revoked_at: null, expires_at: { lte: until } },
        select: {
            id: true,
            environment: true,
            expires_at: true,
            identity: { select: { id: true, name: true, sponsor_user_id: true } },
        },
        orderBy: { expires_at: 'asc' },
        take: 100,
    })
    output({
        within_days: withinDays,
        expiring_credentials: credentials.map((credential) => ({
            credential_id: credential.id,
            environment: credential.environment,
            expires_at: credential.expires_at.toISOString(),
            identity_id: credential.identity.id,
            identity_name: credential.identity.name,
            sponsor_user_id: credential.identity.sponsor_user_id,
        })),
    })
}

async function auditReport(flags: Flags) {
    const limit = Math.min(flags.get('limit') ? integer(flags, 'limit') : 50, 100)
    const events = await prisma.publishing_audit_events.findMany({
        orderBy: { id: 'desc' },
        take: limit,
        select: {
            id: true,
            created_at: true,
            actor_kind: true,
            action: true,
            identity_id: true,
            admin_actor_id: true,
            post_id: true,
            external_id: true,
            from_state: true,
            to_state: true,
            from_version: true,
            to_version: true,
        },
    })
    output({
        events: events.map((event) => ({ ...event, id: event.id.toString(), created_at: event.created_at.toISOString() })),
    })
}

async function schedulerReport(flags: Flags) {
    const maxAgeSeconds = flags.get('max-age-seconds')
        ? integer(flags, 'max-age-seconds')
        : 120
    const state = await prisma.publishing_scheduler_state.findUnique({
        where: { id: 1 },
        select: {
            last_started_at: true,
            last_completed_at: true,
            last_success_at: true,
            last_run_id: true,
            last_result_code: true,
            last_processed_count: true,
            last_published_count: true,
            last_blocked_count: true,
        },
    })
    const now = Date.now()
    const successAgeSeconds = state?.last_success_at
        ? Math.floor((now - state.last_success_at.getTime()) / 1000)
        : null
    const healthy = successAgeSeconds !== null && successAgeSeconds <= maxAgeSeconds
    output({
        healthy,
        max_age_seconds: maxAgeSeconds,
        success_age_seconds: successAgeSeconds,
        last_started_at: state?.last_started_at?.toISOString() ?? null,
        last_completed_at: state?.last_completed_at?.toISOString() ?? null,
        last_success_at: state?.last_success_at?.toISOString() ?? null,
        last_run_id: state?.last_run_id ?? null,
        last_result_code: state?.last_result_code ?? null,
        last_processed_count: state?.last_processed_count ?? 0,
        last_published_count: state?.last_published_count ?? 0,
        last_blocked_count: state?.last_blocked_count ?? 0,
    })
    if (!healthy) process.exitCode = 1
}

function usage(): void {
    process.stderr.write([
        'Usage: npm run publishing:control -- <command> [flags]',
        'Commands: identity-create, identity-disable, identity-enable, capability-grant, capability-revoke, ip-add, ip-remove, credential-issue, credential-rotate, credential-revoke, gate-set, expiry-report, audit-report, scheduler-report',
        'Every mutation needs --actor-admin-id <id> --confirm yes.',
    ].join('\n') + '\n')
}

async function main(): Promise<void> {
    const [command, ...arguments_] = process.argv.slice(2)
    if (!command || command === '--help') {
        usage()
        return
    }
    const flags = parseFlags(arguments_)
    switch (command) {
        case 'identity-create': return createIdentity(flags)
        case 'identity-disable': return setIdentityActive(flags, false)
        case 'identity-enable': return setIdentityActive(flags, true)
        case 'capability-grant': return setCapability(flags, true)
        case 'capability-revoke': return setCapability(flags, false)
        case 'ip-add': return setIpAllowlist(flags, true)
        case 'ip-remove': return setIpAllowlist(flags, false)
        case 'credential-issue': return issueCredential(flags)
        case 'credential-rotate': return issueCredential(flags, true)
        case 'credential-revoke': return revokeCredential(flags)
        case 'gate-set': return setGlobalGate(flags)
        case 'expiry-report': return expiryReport(flags)
        case 'audit-report': return auditReport(flags)
        case 'scheduler-report': return schedulerReport(flags)
        default: throw new ControlInputError(`Unknown command: ${command}`)
    }
}

try {
    await main()
} catch (error) {
    if (error instanceof ControlInputError) {
        process.stderr.write(`Publishing control input error: ${error.message}\n`)
    } else {
        process.stderr.write('Publishing control command failed. Inspect the private operator log.\n')
    }
    process.exitCode = 1
} finally {
    await prisma.$disconnect()
}
