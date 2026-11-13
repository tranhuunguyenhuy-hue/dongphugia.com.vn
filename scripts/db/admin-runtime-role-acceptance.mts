import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma, PrismaClient } from '@prisma/client'

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const migrationPath = resolve(
    repositoryRoot,
    'supabase/migrations/20261113111053_dpg_admin_runtime_login_least_privilege.sql',
)
const setupPath = resolve(repositoryRoot, 'supabase/tests/admin_runtime_role_seed.sql')
const acceptancePath = resolve(repositoryRoot, 'supabase/tests/admin_runtime_role_acceptance.sql')
const revokePath = resolve(repositoryRoot, 'supabase/tests/admin_runtime_role_revoke.sql')

const sourceUrl = process.env.ADMIN_RUNTIME_ROLE_TEST_SOURCE_URL
if (!sourceUrl) {
    throw new Error('Set ADMIN_RUNTIME_ROLE_TEST_SOURCE_URL to the local full-preview PostgreSQL URL.')
}

const parsedUrl = new URL(sourceUrl)
const host = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase()
const sourceDatabase = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''))
if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new Error('The role acceptance runner only accepts a local PostgreSQL URL.')
}
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('The role acceptance runner refuses non-loopback database hosts.')
}
if (sourceDatabase !== 'dpg_legacy_admin_full_preview') {
    throw new Error('Use only the local schema source dpg_legacy_admin_full_preview; no rows are dumped.')
}

const testDatabase = `dpg_admin_role_test_${process.pid}_${randomBytes(4).toString('hex')}`
const baselineRoles = ['dpg_runtime', 'dpg_readonly', 'authenticated']
const adminRole = 'dpg_admin_runtime_login'
const pgEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: host,
    PGPORT: parsedUrl.port || '5432',
    PGUSER: decodeURIComponent(parsedUrl.username),
    PGDATABASE: sourceDatabase,
}
if (parsedUrl.password) pgEnvironment.PGPASSWORD = decodeURIComponent(parsedUrl.password)
delete pgEnvironment.DATABASE_URL
delete pgEnvironment.DIRECT_URL

function run(command: string, args: string[], input?: string) {
    const result = spawnSync(command, args, {
        cwd: repositoryRoot,
        env: pgEnvironment,
        encoding: 'utf8',
        input,
        maxBuffer: 32 * 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || 'no command output').trim().slice(-2200)
        throw new Error(`${command} failed (${result.status}): ${detail}`)
    }
    return result.stdout
}

function psql(database: string, args: string[] = [], input?: string) {
    return run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', database, ...args], input)
}

function isPrivilegeError(error: unknown): boolean {
    const detail = error as { code?: string; meta?: { code?: string; message?: string } }
    const message = error instanceof Error ? error.message : String(error)
    return detail.meta?.code === '42501'
        || detail.code === '42501'
        || /permission denied|insufficient privilege|42501/i.test(`${message} ${detail.meta?.message ?? ''}`)
}

async function assertPrismaRoleQueries(testDatabaseName: string): Promise<void> {
    const authorityUrl = new URL(sourceUrl)
    authorityUrl.pathname = `/${testDatabaseName}`
    authorityUrl.search = '?schema=dpg_app'
    const prisma = new PrismaClient({ datasources: { db: { url: authorityUrl.toString() } } })
    const runAsRole = async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
        prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe('SET LOCAL ROLE dpg_admin_runtime_login')
            return operation(tx)
        })
    const expectPrivilegeDenied = async (label: string, operation: () => Promise<unknown>) => {
        try {
            await operation()
        } catch (error) {
            if (isPrivilegeError(error)) return
            throw new Error(`${label} failed for a reason other than PostgreSQL privilege denial.`)
        }
        throw new Error(`${label} unexpectedly succeeded under dpg_admin_runtime_login.`)
    }

    try {
        const fixtures = await prisma.$transaction(async (tx) => {
            const admin = await tx.admin_users.create({
                data: {
                    email: 'prisma-role-fixture@example.invalid',
                    username: 'prisma-role-fixture',
                    name: 'Prisma Role Fixture',
                    password_hash: 'not-a-real-password-hash',
                    role: 'admin',
                    is_active: true,
                },
                select: { id: true },
            })
            const category = await tx.categories.create({
                data: { name: 'Prisma Role Fixture Category', slug: 'prisma-role-fixture-category' },
                select: { id: true },
            })
            const subcategory = await tx.subcategories.create({
                data: {
                    category_id: category.id,
                    name: 'Prisma Role Fixture Subcategory',
                    slug: 'prisma-role-fixture-subcategory',
                },
                select: { id: true },
            })
            const brand = await tx.brands.create({
                data: { name: 'Prisma Role Fixture Brand', slug: 'prisma-role-fixture-brand' },
                select: { id: true },
            })
            const productType = await tx.product_types.create({
                data: { subcategory_id: subcategory.id, name: 'Prisma Role Fixture Type', slug: 'prisma-role-fixture-type' },
                select: { id: true },
            })
            const productSubType = await tx.product_sub_types.create({
                data: { product_type_id: productType.id, name: 'Prisma Role Fixture Subtype', slug: 'prisma-role-fixture-subtype' },
                select: { id: true },
            })
            const taxon = await tx.catalog_taxons.create({
                data: { name: 'Prisma Role Fixture Taxon', slug: 'prisma-role-fixture-taxon', canonical_path: 'prisma-role-fixture-taxon' },
                select: { id: true },
            })
            const blogCategory = await tx.blog_categories.create({
                data: { name: 'Prisma Role Fixture Blog Category', slug: 'prisma-role-fixture-blog-category' },
                select: { id: true },
            })
            const blogTag = await tx.blog_tags.create({
                data: { name: 'Prisma Role Fixture Blog Tag', slug: 'prisma-role-fixture-blog-tag' },
                select: { id: true },
            })
            const identity = await tx.publishing_machine_identities.create({
                data: {
                    id: '00000000-0000-4000-8000-000000000051',
                    name: 'Prisma Role Fixture Publisher',
                    sponsor_user_id: admin.id,
                    is_active: true,
                },
                select: { id: true },
            })
            const media = await tx.publishing_managed_media.create({
                data: {
                    id: '00000000-0000-4000-8000-000000000052',
                    identity_id: identity.id,
                    purpose: 'thumbnail',
                    status: 'ready',
                    source_mime: 'image/webp',
                    source_bytes: 13,
                    source_sha256: 'a'.repeat(64),
                    storage_path: 'prisma-role-fixture/media.webp',
                    primary_url: 'https://media.example.invalid/prisma-role-fixture.webp',
                },
                select: { id: true },
            })
            const sentinel = await tx.$queryRaw<Array<{ id: number }>>`
                INSERT INTO dpg_app.products
                  (sku, name, slug, category_id, component_skus, price_source,
                   price_confidence, source_system, source_confidence)
                VALUES
                  ('PRISMA-ROLE-SENTINEL', 'Prisma Role Sentinel', 'prisma-role-sentinel',
                   ${category.id}, NULL, 'capture-source', 'high', 'legacy-test', 'verified')
                RETURNING id
            `
            const child = await tx.products.create({
                data: { sku: 'PRISMA-ROLE-CHILD', name: 'Prisma Role Child', slug: 'prisma-role-child', category_id: category.id },
                select: { id: true },
            })
            const linkedPost = await tx.blog_posts.create({
                data: {
                    title: 'Prisma Role Linked Post',
                    slug: 'prisma-role-linked-post',
                    content: 'Synthetic linked content',
                    category_id: blogCategory.id,
                    publishing_identity_id: identity.id,
                    external_id: 'prisma-role-linked-external',
                },
                select: { id: true },
            })

            return {
                adminId: admin.id,
                categoryId: category.id,
                brandId: brand.id,
                productTypeId: productType.id,
                productSubTypeId: productSubType.id,
                taxonId: taxon.id,
                blogCategoryId: blogCategory.id,
                blogTagId: blogTag.id,
                identityId: identity.id,
                mediaId: media.id,
                sentinelId: sentinel[0].id,
                childId: child.id,
                linkedPostId: linkedPost.id,
            }
        })

        await runAsRole(async (tx) => {
            const login = await tx.admin_users.findFirst({
                where: { OR: [{ email: 'prisma-role-fixture@example.invalid' }, { username: 'prisma-role-fixture' }] },
                select: { id: true, email: true, username: true, name: true, role: true, password_hash: true, is_active: true },
            })
            if (login?.id !== fixtures.adminId) throw new Error('Prisma login select failed under the runtime role.')

            const sessionHash = 'c'.repeat(64)
            await tx.admin_sessions.create({
                data: { user_id: fixtures.adminId, token_hash: sessionHash, ip_address: '127.0.0.1', user_agent: 'fixture-agent', expires_at: new Date(Date.now() + 60_000) },
                select: { id: true },
            })
            await tx.admin_users.update({
                where: { id: fixtures.adminId },
                data: { last_login_at: new Date() },
                select: { id: true },
            })
            const verified = await tx.admin_sessions.findUnique({
                where: { token_hash: sessionHash },
                select: {
                    expires_at: true,
                    user: { select: { id: true, email: true, name: true, role: true, avatar_url: true, is_active: true } },
                },
            })
            if (verified?.user.id !== fixtures.adminId) throw new Error('Prisma session verification select failed.')
            await tx.admin_sessions.delete({ where: { token_hash: sessionHash }, select: { id: true } })

            const productRead = await tx.products.findUnique({
                where: { id: fixtures.sentinelId },
                include: {
                    categories: { select: { id: true, name: true, slug: true } },
                    subcategories: { select: { id: true, name: true, slug: true } },
                    brands: { select: { id: true, name: true, slug: true } },
                    product_types: { select: { id: true, slug: true, name: true } },
                    product_sub_types: { select: { id: true, slug: true, name: true, product_type_id: true } },
                    product_taxon_assignments: { include: { catalog_taxons: true } },
                    product_spec_values: { include: { spec_definitions: true, spec_options: true } },
                    product_documents: true,
                    product_images: true,
                    product_feature_values: { include: { product_features: true } },
                },
            })
            const nullableComponentCheck = await tx.$queryRaw<Array<{ is_null: boolean }>>`
                SELECT component_skus IS NULL AS is_null
                FROM dpg_app.products WHERE id = ${fixtures.sentinelId}
            `
            if (!productRead || !nullableComponentCheck[0]?.is_null) {
                throw new Error('Prisma Product read failed or changed the nullable component_skus source value.')
            }

            const product = await tx.products.create({
                data: {
                    sku: 'PRISMA-ROLE-CREATED',
                    name: 'Prisma Role Created Product',
                    slug: 'prisma-role-created',
                    category_id: fixtures.categoryId,
                    brand_id: fixtures.brandId,
                    price: 120,
                    list_price: 150,
                    sale_price: 120,
                    price_display: 'Fixture price',
                    source_url: 'https://source.example.invalid/prisma-role-created',
                    hita_product_id: 'prisma-role-source-id',
                },
                select: { id: true },
            })
            await tx.products.update({
                where: { id: product.id },
                data: {
                    name: 'Prisma Role Updated Product',
                    price: 125,
                    brand_id: fixtures.brandId,
                    product_type_id: fixtures.productTypeId,
                    product_sub_type_id: fixtures.productSubTypeId,
                    updated_at: new Date(),
                },
                select: { id: true },
            })
            await tx.product_taxon_assignments.deleteMany({ where: { product_id: product.id } })
            await tx.product_taxon_assignments.createMany({
                data: [{ product_id: product.id, taxon_id: fixtures.taxonId, is_primary: true, role: 'primary', sort_order: 0, source: 'manual', confidence: 100 }],
            })
            const image = await tx.product_images.create({
                data: { product_id: product.id, image_url: 'https://media.example.invalid/prisma-role-product.webp', image_type: 'gallery', sort_order: 0 },
                select: { id: true },
            })
            await tx.product_images.update({ where: { id: image.id }, data: { sort_order: 1 }, select: { id: true } })
            await tx.product_images.delete({ where: { id: image.id }, select: { id: true } })
            const relationship = await tx.product_relationships.create({
                data: { parent_id: fixtures.sentinelId, child_id: fixtures.childId, child_sku: 'PRISMA-ROLE-CHILD', relationship_type: 'component', sort_order: 0 },
                select: { id: true },
            })
            await tx.product_relationships.delete({ where: { id: relationship.id }, select: { id: true } })
            await tx.audit_logs.create({
                data: {
                    user_id: fixtures.adminId,
                    action: 'pim.product_editor.updated',
                    entity_type: 'product',
                    entity_id: product.id,
                    new_value: { changed_fields: ['name'] },
                },
                select: { id: true },
            })
            await tx.products.delete({ where: { id: product.id }, select: { id: true } })

            const blogCategories = await tx.blog_categories.findMany({ select: { id: true, name: true, slug: true } })
            const blogTags = await tx.blog_tags.findMany({ select: { id: true, name: true, slug: true, post_count: true } })
            const mediaRows = await tx.publishing_managed_media.findMany({
                where: {
                    status: 'ready',
                    identity: { is_active: true },
                    primary_url: { in: ['https://media.example.invalid/prisma-role-fixture.webp'] },
                },
                select: { id: true, purpose: true, primary_url: true, status: true },
            })
            if (!blogCategories.length || !blogTags.length || mediaRows[0]?.id !== fixtures.mediaId) {
                throw new Error('Prisma Blog reference/media reads failed under the runtime role.')
            }
            const post = await tx.blog_posts.create({
                data: {
                    title: 'Prisma Role Created Blog Post',
                    slug: 'prisma-role-created-blog-post',
                    content: '<p>Synthetic Blog body</p>',
                    category_id: fixtures.blogCategoryId,
                },
                select: { id: true },
            })
            await tx.blog_post_tags.createMany({ data: [{ post_id: post.id, tag_id: fixtures.blogTagId }] })
            await tx.$executeRaw(Prisma.sql`
                UPDATE dpg_app.blog_tags
                SET post_count=(SELECT count(*) FROM dpg_app.blog_post_tags WHERE blog_post_tags.tag_id=blog_tags.id)
            `)
            const updatedPost = await tx.blog_posts.updateMany({
                where: { id: post.id, version: 1 },
                data: { title: 'Prisma Role Updated Blog Post', status: 'published', version: { increment: 1 }, updated_at: new Date() },
            })
            if (updatedPost.count !== 1) throw new Error('Prisma Blog update failed under the runtime role.')
            const linkedPost = await tx.blog_posts.findUnique({
                where: { id: fixtures.linkedPostId },
                include: {
                    blog_categories: { select: { slug: true } },
                    publishing_identity: { select: { sponsor_user_id: true } },
                },
            })
            if (linkedPost?.publishing_identity?.sponsor_user_id !== fixtures.adminId) {
                throw new Error('Prisma linked Blog identity lookup failed.')
            }
            await tx.publishing_audit_events.create({
                data: {
                    actor_kind: 'admin',
                    identity_id: fixtures.identityId,
                    admin_actor_id: fixtures.adminId,
                    sponsor_user_id: fixtures.adminId,
                    action: 'post.cms_updated',
                    post_id: fixtures.linkedPostId,
                    external_id: 'prisma-role-linked-external',
                    from_version: 1,
                    to_version: 2,
                    from_state: 'draft',
                    to_state: 'published',
                    changed_fields: ['cms_form'],
                },
                select: { id: true },
            })
            const deletedPost = await tx.blog_posts.deleteMany({ where: { id: post.id, version: 2 } })
            if (deletedPost.count !== 1) throw new Error('Prisma Blog delete failed under the runtime role.')
            return blogTags
        })

        await expectPrivilegeDenied('deferred orders read', () => runAsRole((tx) => tx.orders.findMany({ take: 1 })))
        await expectPrivilegeDenied('deferred customers read', () => runAsRole((tx) => tx.customers.findMany({ take: 1 })))
        await expectPrivilegeDenied('protected Product provenance update', () => runAsRole((tx) => tx.products.update({
            where: { id: fixtures.sentinelId }, data: { price_source: 'manual' }, select: { id: true },
        })))
        await expectPrivilegeDenied('protected component_skus update', () => runAsRole((tx) => tx.products.update({
            where: { id: fixtures.sentinelId }, data: { component_skus: ['must-not-write'] }, select: { id: true },
        })))
        await expectPrivilegeDenied('deferred Blog tag metadata update', () => runAsRole((tx) => tx.blog_tags.update({
            where: { id: fixtures.blogTagId }, data: { name: 'must-not-rename' }, select: { id: true },
        })))
        await expectPrivilegeDenied('audit history read', () => runAsRole((tx) => tx.audit_logs.findMany({ take: 1 })))
        await expectPrivilegeDenied('Publishing audit history read', () => runAsRole((tx) => tx.publishing_audit_events.findMany({ take: 1 })))
        await expectPrivilegeDenied('unneeded session fields read', () => runAsRole((tx) => tx.admin_sessions.findMany({ take: 1 })))
        await expectPrivilegeDenied('admin role update', () => runAsRole((tx) => tx.admin_users.update({
            where: { id: fixtures.adminId }, data: { role: 'superadmin' }, select: { id: true },
        })))
    } finally {
        await prisma.$disconnect()
    }
}

let databaseCreated = false
let originallyExistingRoles = new Set<string>()
let primaryError: unknown

try {
    const existingRoles = psql(
        sourceDatabase,
        ['-A', '-t', '-c', `SELECT rolname FROM pg_roles WHERE rolname IN ('${adminRole}', '${baselineRoles.join("','")}') ORDER BY rolname`],
    ).trim().split(/\s+/).filter(Boolean)
    originallyExistingRoles = new Set(existingRoles)
    if (originallyExistingRoles.has(adminRole)) {
        throw new Error(`Refusing to reuse the existing ${adminRole} role on the local cluster.`)
    }

    psql(sourceDatabase, ['-c', `CREATE DATABASE ${testDatabase} TEMPLATE template0`])
    databaseCreated = true

    const schemaDump = run('pg_dump', [
        '--schema-only',
        '--no-owner',
        '--no-privileges',
        '--schema=public',
        '--dbname',
        sourceDatabase,
    ])
    psql(testDatabase, ['-c', 'DROP SCHEMA public CASCADE'])
    psql(testDatabase, [], schemaDump)
    psql(testDatabase, ['-c', 'ALTER SCHEMA public RENAME TO dpg_app; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO PUBLIC'])
    psql(testDatabase, ['-f', setupPath])
    psql(testDatabase, ['-f', migrationPath])
    psql(testDatabase, ['-f', acceptancePath])
    await assertPrismaRoleQueries(testDatabase)
    psql(testDatabase, ['-f', revokePath])
    process.stdout.write('Local-only PostgreSQL role acceptance and rollback passed.\n')
} catch (error) {
    primaryError = error
} finally {
    const cleanupErrors: string[] = []
    if (databaseCreated) {
        try {
            run('dropdb', ['--if-exists', testDatabase])
        } catch (error) {
            cleanupErrors.push(error instanceof Error ? error.message : String(error))
        }
    }
    const rolesToDrop = [
        ...(databaseCreated ? [adminRole] : []),
        ...baselineRoles.filter((role) => !originallyExistingRoles.has(role)),
    ]
    if (rolesToDrop.length) {
        try {
            psql(sourceDatabase, ['-c', `DROP ROLE IF EXISTS ${rolesToDrop.join(', ')}`])
        } catch (error) {
            cleanupErrors.push(error instanceof Error ? error.message : String(error))
        }
    }

    if (primaryError || cleanupErrors.length) {
        if (primaryError) {
            const message = primaryError instanceof Error ? primaryError.message : String(primaryError)
            process.stderr.write(`Local role acceptance failed: ${message}\n`)
        }
        for (const message of cleanupErrors) process.stderr.write(`Local role acceptance cleanup failed: ${message}\n`)
        process.exitCode = 1
    }
}
