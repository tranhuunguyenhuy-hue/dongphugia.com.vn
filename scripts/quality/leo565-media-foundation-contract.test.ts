import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { Client } from 'pg'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { processProductV1Media } from '../../src/lib/media/v1/processor'
import {
    MediaObjectNotFoundError,
    mediaRegistrationInput,
    providerVerificationInput,
    storeAndVerifyProductV1Bundle,
    type ImmutableMediaObjectStore,
    type ProviderObject,
} from '../../src/lib/media/v1/provider'

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

class DisposableMediaStore implements ImmutableMediaObjectStore {
    readonly objects = new Map<string, { bytes: Buffer; mimeType: string }>()

    async put(object: { key: string; bytes: Buffer; mimeType: string }): Promise<void> {
        this.objects.set(object.key, {
            bytes: Buffer.from(object.bytes),
            mimeType: object.mimeType,
        })
    }

    async read(key: string, maxBytes = 5 * 1024 * 1024): Promise<ProviderObject> {
        const object = this.objects.get(key)
        if (!object) throw new MediaObjectNotFoundError()
        if (object.bytes.byteLength > maxBytes) throw new Error('synthetic bound exceeded')
        const hash = createHash('sha256').update(object.bytes).digest('hex')
        return {
            key,
            bytes: object.bytes,
            sha256: hash,
            byteSize: object.bytes.byteLength,
            mimeType: object.mimeType,
        }
    }
}

async function runGeneratedSqlPayloadFlow(client: Client): Promise<void> {
    const input = await sharp({
        create: {
            width: 1600,
            height: 800,
            channels: 4,
            background: { r: 36, g: 116, b: 142, alpha: 1 },
        },
    }).png().toBuffer()
    const bundle = await processProductV1Media(input, 'IMAGE', 'image/png')
    const registration = mediaRegistrationInput(bundle)
    expect(Object.keys(registration).sort()).toEqual([
        'byte_size',
        'delivery_object_key',
        'height_px',
        'kind',
        'mime_type',
        'original_object_key',
        'profile_version',
        'provenance',
        'sha256',
        'variants',
        'width_px',
    ])
    expect(registration).toMatchObject({
        kind: 'IMAGE',
        original_object_key: bundle.original.key,
        delivery_object_key: bundle.primaryVariant.key,
        profile_version: bundle.profileVersion,
        sha256: bundle.source.sha256,
        mime_type: bundle.source.mimeType,
        byte_size: bundle.source.byteSize,
        width_px: bundle.source.widthPx,
        height_px: bundle.source.heightPx,
        provenance: 'upload:bunny-v1',
    })
    expect(registration.variants.every((variant) => variant.profile_version === 'product-v1')).toBe(true)
    expect(Object.keys(registration.variants[0] ?? {}).sort()).toEqual([
        'byte_size',
        'delivery_object_key',
        'height_px',
        'mime_type',
        'profile_version',
        'sha256',
        'target_width_px',
        'width_px',
    ])

    const stores = {
        originals: new DisposableMediaStore(),
        delivery: new DisposableMediaStore(),
    }
    const verification = await storeAndVerifyProductV1Bundle(bundle, stores)
    const providerVerification = providerVerificationInput(verification)
    expect(Object.keys(providerVerification).sort()).toEqual(['delivery', 'original', 'provider'])
    expect(providerVerification.provider).toBe('bunny')
    expect(Object.keys(providerVerification.original).sort()).toEqual([
        'byte_size',
        'key',
        'mime_type',
        'sha256',
    ])
    expect(providerVerification.delivery.every((object) => Object.keys(object).sort().join(',') === 'byte_size,key,mime_type,sha256')).toBe(true)

    await client.query('begin')
    try {
        await client.query(`
          insert into dpg_v1.staff_users (auth_user_id, email, display_name, status)
          values ('66000000-0000-4000-8000-000000000001', 'leo565-generated@example.invalid', 'LEO-565 Generated Staff', 'active');
          insert into dpg_v1.staff_user_roles (auth_user_id, role)
          values ('66000000-0000-4000-8000-000000000001', 'Product');
          insert into dpg_v1.brands (id, name, slug)
          values ('66000000-0000-4000-8000-000000000002', 'LEO-565 Generated Brand', 'leo-565-generated-brand');
          insert into dpg_v1.categories (id, parent_id, sector, name, slug, is_leaf, sort_order)
          values ('66000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'kitchen', 'LEO-565 Generated Category', 'leo-565-generated-category', true, 0);
          insert into dpg_v1.products (id, sku, model, name, slug, brand_id, primary_category_id, retail_price, availability, status)
          values ('66000000-0000-4000-8000-000000000004', 'LEO565-GENERATED-P1', 'LEO565-GENERATED-M1', 'LEO-565 Generated Product', 'leo-565-generated-product', '66000000-0000-4000-8000-000000000002', '66000000-0000-4000-8000-000000000003', 125000, 'IN_STOCK', 'DRAFT');
          insert into dpg_v1.product_source_provenance (id, product_id, source_kind, source_reference, quality, captured_at)
          values ('66000000-0000-4000-8000-000000000005', '66000000-0000-4000-8000-000000000004', 'manufacturer', 'synthetic:leo565:generated', 'official', clock_timestamp());
        `)
        await client.query('set local role authenticated')
        await client.query(
            "select set_config('request.jwt.claim.sub', '66000000-0000-4000-8000-000000000001', true)",
        )

        const registeredResult = await client.query<{ result: unknown }>(
            'select dpg_v1_api.catalogue_media_register($1::jsonb, $2::text) as result',
            [JSON.stringify(registration), 'leo565-generated-media-register'],
        )
        const registered = registeredResult.rows[0]?.result
        if (!registered || typeof registered !== 'object' || !('media_asset_id' in registered)) {
            throw new Error('LEO565_GENERATED_REGISTER_RESPONSE_INVALID')
        }
        const mediaId = (registered as { media_asset_id?: unknown }).media_asset_id
        if (typeof mediaId !== 'string') throw new Error('LEO565_GENERATED_MEDIA_ID_INVALID')

        const readyResult = await client.query<{ result: unknown }>(
            'select dpg_v1_api.catalogue_media_mark_ready($1::uuid, $2::jsonb, $3::text) as result',
            [mediaId, JSON.stringify(providerVerification), 'leo565-generated-media-ready'],
        )
        const ready = readyResult.rows[0]?.result
        if (!ready || typeof ready !== 'object' || !('state' in ready) || ready.state !== 'READY') {
            throw new Error('LEO565_GENERATED_READY_RESPONSE_INVALID')
        }
        const stateResult = await client.query<{ state: string; variant_count: string }>(
            `select asset.state, count(variant.id)::text as variant_count
             from dpg_v1.media_assets asset
             left join dpg_v1.media_variants variant on variant.media_asset_id = asset.id
             where asset.id = $1
             group by asset.id, asset.state`,
            [mediaId],
        )
        expect(stateResult.rows[0]).toMatchObject({ state: 'READY', variant_count: '3' })
    } finally {
        await client.query('rollback')
    }
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
        expect(provider).toContain('serializeMediaObject')
        expect(provider).toContain("profile_version: 'product-v1'")
        expect(provider).toContain("keyField: 'key'")
        expect(provider).toContain("keyField: 'delivery_object_key'")
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
        expect(migration).toContain("'-' || btrim(variant.sha256) || '.webp'")
        expect(migration).toContain('PRODUCT_MEDIA_REQUIRES_READY_IMAGE')
        expect(migration).toContain('PRODUCT_DOCUMENT_REQUIRES_READY_DOCUMENT')
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
        expect(acceptance).toContain('pending image attachment unexpectedly succeeded')
        expect(acceptance).toContain('document Product GALLERY attachment unexpectedly succeeded')
        expect(acceptance).toContain('tombstoned image attachment unexpectedly succeeded')
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
            await runGeneratedSqlPayloadFlow(client)
            const acceptance = (await readFile(acceptancePath, 'utf8')).replace(/^\\set[^\n]*\n/, '')
            await client.query(acceptance)
        } finally {
            await client.end()
        }
    })
})
