/**
 * Disposable-PostgreSQL acceptance harness for Publishing API authority races.
 * It never runs unless the caller explicitly opts in and supplies a staging
 * disposable database. It creates test-only records and intentionally leaves
 * their immutable audit evidence in that disposable database.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

import { Client } from 'pg'

const databaseUrl = process.env.PUBLISHING_CONCURRENCY_TEST_DATABASE_URL
const sponsorId = Number(process.env.PUBLISHING_TEST_SPONSOR_ADMIN_ID)
if (
    !databaseUrl
    || !Number.isInteger(sponsorId)
    || sponsorId < 1
    || process.env.PUBLISHING_CONCURRENCY_TEST_CONFIRM !== 'disposable'
) {
    throw new Error(
        'Set PUBLISHING_CONCURRENCY_TEST_DATABASE_URL, PUBLISHING_TEST_SPONSOR_ADMIN_ID, and PUBLISHING_CONCURRENCY_TEST_CONFIRM=disposable',
    )
}

// All application imports read the explicitly isolated test connection.
process.env.DATABASE_URL = databaseUrl
process.env.PUBLISHING_DATABASE_URL = databaseUrl
process.env.NODE_ENV = 'test'
const projectRequire = createRequire(import.meta.url)
const prisma = projectRequire('../../src/lib/prisma.ts').default as typeof import('../../src/lib/prisma.ts').default
const { lockPublishingMutationAuthorization } = projectRequire('../../src/lib/publishing/auth.ts') as typeof import('../../src/lib/publishing/auth.ts')
const { lockGlobalPublishingGate } = projectRequire('../../src/lib/publishing/authority.ts') as typeof import('../../src/lib/publishing/authority.ts')

type ControlResult = { code: number; stdout: string }

function control(args: string[]): Promise<ControlResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            ['node_modules/tsx/dist/cli.mjs', 'scripts/publishing/control.mts', ...args],
            { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
        )
        let stdout = ''
        child.stdout.on('data', (chunk) => { stdout += String(chunk) })
        child.once('error', reject)
        child.once('close', (code) => resolve({ code: code ?? 1, stdout }))
    })
}

function controlArgs(identityId: string): string[] {
    return [
        '--actor-admin-id', String(sponsorId), '--confirm', 'yes',
        '--identity-id', identityId, '--environment', 'staging',
    ]
}

function parseCredential(result: ControlResult): { credential_id: string } {
    assert.equal(result.code, 0, 'credential command should succeed')
    return JSON.parse(result.stdout) as { credential_id: string }
}

async function expectBoundaryRejectsAfter(
    identityId: string,
    credentialId: string,
    controlSql: (client: Client) => Promise<void>,
    requiredCapabilities: Array<'posts:write' | 'posts:publish'>,
    expectedCode: string,
) {
    const controller = new Client({ connectionString: databaseUrl })
    await controller.connect()
    try {
        await controller.query('BEGIN')
        await controlSql(controller)
        const mutation = prisma.$transaction((transaction) =>
            lockPublishingMutationAuthorization(transaction, {
                credentialId,
                identityId,
                environment: 'staging',
                requiredCapabilities,
                clientIp: null,
            }),
        )
        await controller.query('COMMIT')
        await assert.rejects(mutation, (error: unknown) =>
            typeof error === 'object'
            && error !== null
            && 'code' in error
            && error.code === expectedCode,
        )
    } finally {
        await controller.query('ROLLBACK').catch(() => undefined)
        await controller.end()
    }
}

async function main() {
    const sponsor = await prisma.admin_users.findFirst({
        where: { id: sponsorId, is_active: true },
        select: { id: true },
    })
    assert(sponsor, 'PUBLISHING_TEST_SPONSOR_ADMIN_ID must be an active admin')
    const globalControl = await prisma.publishing_global_controls.findUnique({
        where: { id: 1 },
        select: { publishing_enabled: true, version: true },
    })
    assert(globalControl, 'Publishing migration must be applied before this harness')

    const identityId = randomUUID()
    await prisma.publishing_machine_identities.create({
        data: {
            id: identityId,
            name: `concurrency-test-${identityId.slice(0, 8)}`,
            sponsor_user_id: sponsorId,
            capabilities: {
                create: [
                    { capability: 'posts:write' },
                    { capability: 'posts:publish' },
                ],
            },
        },
    })

    const issueArgs = ['credential-issue', ...controlArgs(identityId)]
    const issued = await Promise.all([control(issueArgs), control(issueArgs)])
    const issueSuccesses = issued.filter(({ code }) => code === 0)
    assert.equal(issueSuccesses.length, 1, 'concurrent issue must create exactly one credential')
    const first = parseCredential(issueSuccesses[0])

    const rotateArgs = [
        'credential-rotate', ...controlArgs(identityId),
        '--from-credential-id', first.credential_id,
    ]
    const rotated = await Promise.all([control(rotateArgs), control(rotateArgs)])
    assert.equal(rotated.filter(({ code }) => code === 0).length, 1, 'concurrent rotation must create one overlap credential')
    const active = await prisma.publishing_credentials.findMany({
        where: { identity_id: identityId, revoked_at: null, expires_at: { gt: new Date() } },
        select: { id: true },
    })
    assert.equal(active.length, 2, 'Machine Identity must never exceed two active credentials')
    const third = await control(['credential-issue', ...controlArgs(identityId), '--environment', 'production'])
    assert.notEqual(third.code, 0, 'a third active credential must be rejected')

    await expectBoundaryRejectsAfter(
        identityId,
        active[0].id,
        async (client) => {
            await client.query(
                "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                [`publishing.identity.${identityId}`],
            )
            await client.query('SELECT id FROM publishing_machine_identities WHERE id = $1 FOR UPDATE', [identityId])
            await client.query('SELECT id FROM publishing_credentials WHERE id = $1 FOR UPDATE', [active[0].id])
            await client.query('UPDATE publishing_credentials SET revoked_at = now() WHERE id = $1', [active[0].id])
        },
        ['posts:write'],
        'CREDENTIAL_REVOKED',
    )
    await expectBoundaryRejectsAfter(
        identityId,
        active[1].id,
        async (client) => {
            await client.query(
                "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                [`publishing.identity.${identityId}`],
            )
            await client.query('SELECT id FROM publishing_machine_identities WHERE id = $1 FOR UPDATE', [identityId])
            await client.query('SELECT capability FROM publishing_identity_capabilities WHERE identity_id = $1 FOR UPDATE', [identityId])
            await client.query("UPDATE publishing_identity_capabilities SET revoked_at = now() WHERE identity_id = $1 AND capability = 'posts:publish'", [identityId])
        },
        ['posts:write', 'posts:publish'],
        'CAPABILITY_REQUIRED',
    )

    await prisma.publishing_global_controls.update({
        where: { id: 1 },
        data: { publishing_enabled: true },
    })
    const gateController = new Client({ connectionString: databaseUrl })
    await gateController.connect()
    try {
        await gateController.query('BEGIN')
        await gateController.query(
            "SELECT pg_advisory_xact_lock(hashtextextended('publishing.global-gate', 0))",
        )
        await gateController.query('SELECT id FROM publishing_global_controls WHERE id = 1 FOR UPDATE')
        await gateController.query('UPDATE publishing_global_controls SET publishing_enabled = false WHERE id = 1')
        const mutation = prisma.$transaction(lockGlobalPublishingGate)
        await gateController.query('COMMIT')
        assert.equal(await mutation, false, 'a Gate close before mutation must be observed')
    } finally {
        await gateController.query('ROLLBACK').catch(() => undefined)
        await gateController.end()
        await prisma.publishing_global_controls.update({
            where: { id: 1 },
            data: {
                publishing_enabled: globalControl.publishing_enabled,
                version: globalControl.version,
            },
        })
    }

    process.stdout.write(JSON.stringify({ result: 'PASS', checks: 4 }) + '\n')
}

try {
    await main()
} finally {
    await prisma.$disconnect()
}
