import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase/migrations/20260901170000_leo565_media_foundation.sql')
const canonicalMigrationPath = path.join(root, 'supabase/migrations/20260830004338_leo561_canonical_v1_schema.sql')
const authMigrationPath = path.join(root, 'supabase/migrations/20260831173342_leo564_v1_auth_rls_services.sql')
const acceptancePath = path.join(root, 'supabase/tests/leo565_media_foundation.sql')
const integrationUrl = process.env.LEO565_SCHEMA_TEST_URL

function isLoopbackConnection(value: string) {
    try {
        const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '')
        return ['localhost', '127.0.0.1', '::1'].includes(hostname)
    } catch {
        return false
    }
}

const disposableIntegration = Boolean(
    integrationUrl
    && process.env.LEO565_SCHEMA_TEST_CONFIRM === 'disposable'
    && isLoopbackConnection(integrationUrl),
)

async function bootstrapDisposableDatabase(client: Client) {
    await client.query('create schema if not exists extensions')
    const pgcrypto = await client.query<{ schema_name: string | null }>(
        "select n.nspname as schema_name from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto'",
    )
    if (!pgcrypto.rows[0]) {
        await client.query('create extension pgcrypto with schema extensions')
    } else if (pgcrypto.rows[0].schema_name !== 'extensions') {
        await client.query('alter extension pgcrypto set schema extensions')
    }
    await client.query('create schema if not exists auth')
    for (const role of ['anon', 'authenticated', 'service_role', 'dpg_backup', 'dpg_backup_login']) {
        const result = await client.query<{ present: boolean }>(
            'select exists (select 1 from pg_roles where rolname = $1) as present',
            [role],
        )
        if (!result.rows[0]?.present) await client.query('create role "' + role + '" nologin')
    }
    await client.query('grant dpg_backup to dpg_backup_login')
    const authUid = await client.query<{ present: boolean }>(
        "select to_regprocedure('auth.uid()') is not null as present",
    )
    if (!authUid.rows[0]?.present) {
        await client.query(
            "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$",
        )
    }
    await client.query('grant usage on schema auth, extensions to anon, authenticated')
}

describe('LEO-565 V1 media and recovery foundation contract', () => {
    it('locks provider-neutral media contracts and server-only provider adapters', async () => {
        const [contract, processor, provider, bunny, cloudflare, cli, packageJson, migration, backup, manifest, validation, acceptance] = await Promise.all([
            readFile(path.join(root, 'src/lib/media/v1/contract.ts'), 'utf8'),
            readFile(path.join(root, 'src/lib/media/v1/processor.ts'), 'utf8'),
            readFile(path.join(root, 'src/lib/media/v1/provider.ts'), 'utf8'),
            readFile(path.join(root, 'src/lib/media/v1/bunny-store.ts'), 'utf8'),
            readFile(path.join(root, 'src/lib/media/v1/cloudflare-images.ts'), 'utf8'),
            readFile(path.join(root, 'scripts/media/process-product-v1.mts'), 'utf8'),
            readFile(path.join(root, 'package.json'), 'utf8'),
            readFile(migrationPath, 'utf8'),
            readFile(path.join(root, 'scripts/backup/create-encrypted-backup.sh'), 'utf8'),
            readFile(path.join(root, 'scripts/backup/runtime-manifest.sql'), 'utf8'),
            readFile(path.join(root, 'scripts/backup/validate-runtime.sql'), 'utf8'),
            readFile(acceptancePath, 'utf8'),
        ])

        expect(contract).toContain("version: 'product-v1'")
        expect(contract).toContain('widths: Object.freeze([320, 640, 1280])')
        expect(contract).toContain('withoutEnlargement: true')
        expect(contract).toContain('MAX_VARIANTS = 3')
        expect(contract).toContain('MAX_MEDIA_BYTES = 5 * 1024 * 1024')
        expect(contract).toContain('PDF_SIGNATURE_INVALID')
        expect(contract).not.toMatch(/blog|seven|variant[_-]group/i)
        expect(processor).toContain('withoutEnlargement')
        expect(processor).toContain('validatePdfSource')
        expect(processor).toContain('variants: []')
        expect(provider).toContain('MEDIA_STORAGE_CONFLICT')
        expect(provider).toContain('MEDIA_PROVIDER_WRITE_AMBIGUOUS')
        expect(provider).not.toMatch(/(?:\.delete|\.remove|delete\(|prefix\s*\()/i)
        expect(bunny).toContain("import 'server-only'")
        expect(bunny).toContain('AccessKey')
        expect(bunny).toContain('storageZone')
        expect(bunny).toContain('cdnHostname')
        expect(cloudflare).toContain("import 'server-only'")
        expect(cloudflare).toContain("fit: 'scale-down'")
        expect(cloudflare).toContain("format: 'image/webp'")
        expect(cloudflare).not.toMatch(/api.?key|token|secret/i)
        expect(cli).toContain('processProductV1Media')
        expect(cli).not.toMatch(/Bunny|Cloudflare|fetch\(/i)
        expect(JSON.parse(packageJson).scripts['media:process:product-v1']).toBe('tsx scripts/media/process-product-v1.mts')

        expect(migration).toContain('create table dpg_v1.media_variants')
        expect(migration).toContain("provider_name = 'bunny'")
        expect(migration).toContain('MEDIA_ASSET_READY_REQUIRES_PROVIDER_VERIFICATION')
        expect(migration).toContain('MEDIA_ASSET_IDENTITY_IMMUTABLE')
        expect(migration).toContain('catalogue_media_register')
        expect(migration).toContain('catalogue_media_mark_ready')
        expect(migration).toContain('catalogue_product_media_attach')
        expect(migration).toContain('catalogue_product_document_attach')
        expect(migration).toContain('security invoker')
        expect(migration).toContain('grant execute on function dpg_v1_api.catalogue_media_register')
        expect(migration).toContain('dpg_v1_api.catalogue_media_mark_ready')
        expect(migration).not.toMatch(/(?:from|join|update|insert into|delete from)\s+dpg_app\./i)
        expect(migration).not.toMatch(/prefix|BUNNY_API_KEY|CLOUDFLARE_API_TOKEN/i)

        expect(backup).toContain('--schema=dpg_app --schema=dpg_v1 --schema=dpg_control')
        expect(backup).toContain("has_schema_privilege(current_user, 'dpg_v1', 'USAGE')")
        expect(manifest).toContain("'canonicalV1RestoreCounts'")
        expect(manifest).toContain('dpg_v1.media_assets')
        expect(manifest).toContain('dpg_v1.products')
        expect(manifest).toContain('dpg_v1.quotes')
        expect(manifest).toContain('dpg_v1.orders')
        expect(validation).toContain('v1ReadyWithoutProviderVerificationCount')
        expect(validation).toContain('v1ReadyImageVariantViolationCount')
        expect(acceptance).toContain('leo565_media_foundation')
    })

    it('keeps LEO-561 and LEO-564 as the canonical upstream authorities', async () => {
        const [canonical, auth] = await Promise.all([
            readFile(canonicalMigrationPath, 'utf8'),
            readFile(authMigrationPath, 'utf8'),
        ])
        expect(canonical).toContain('create table dpg_v1.media_assets')
        expect(auth).toContain('create schema if not exists dpg_v1_api')
        expect(auth).toContain('security invoker')
        expect(auth).toContain('dpg_v1.require_capability')
    })

    it.runIf(disposableIntegration)('applies to a disposable PostgreSQL target and passes the rollback-only acceptance', async () => {
        if (!integrationUrl) throw new Error('LEO565_SCHEMA_TEST_URL is required')
        const client = new Client({ connectionString: integrationUrl })
        await client.connect()
        try {
            await bootstrapDisposableDatabase(client)
            const existing = await client.query<{ present: boolean }>(
                "select to_regclass('dpg_v1.products') is not null as present",
            )
            if (existing.rows[0]?.present) throw new Error('LEO565_TEST_DATABASE_NOT_BLANK')
            await client.query(await readFile(canonicalMigrationPath, 'utf8'))
            await client.query(await readFile(authMigrationPath, 'utf8'))
            await client.query(await readFile(migrationPath, 'utf8'))
            const acceptance = (await readFile(acceptancePath, 'utf8')).replace(/^\\set[^\n]*\n/, '')
            await client.query(acceptance)
        } finally {
            await client.end()
        }
    })
})
