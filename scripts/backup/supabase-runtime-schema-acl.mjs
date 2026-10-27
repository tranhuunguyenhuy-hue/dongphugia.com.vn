import { readFile } from 'node:fs/promises'

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

function invalid() {
  throw new Error('schema_acl_snapshot_invalid')
}

export function buildSchemaAclRestoreSql(value) {
  let snapshot
  try {
    snapshot = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    invalid()
  }

  const expectedSchemas = ['auth', 'extensions']
  if (!snapshot || snapshot.format !== 'dpg-runtime-schema-acl-v1'
    || !Array.isArray(snapshot.roles) || !Array.isArray(snapshot.schemas)
    || snapshot.schemas.length !== expectedSchemas.length) invalid()

  const roleNames = new Set(snapshot.roles)
  if (roleNames.size !== snapshot.roles.length
    || snapshot.roles.some((name) => typeof name !== 'string' || name.length === 0)) invalid()

  const schemas = [...snapshot.schemas].sort((left, right) => left?.name?.localeCompare(right?.name))
  if (schemas.some((schema, index) => schema?.name !== expectedSchemas[index]
    || typeof schema.owner !== 'string' || !roleNames.has(schema.owner)
    || !Array.isArray(schema.grants))) invalid()

  const statements = ['begin;']
  for (const schema of schemas) {
    const schemaIdentifier = quoteIdentifier(schema.name)
    statements.push(`create schema if not exists ${schemaIdentifier};`)
    statements.push(`revoke all privileges on schema ${schemaIdentifier} from public;`)
    for (const role of [...roleNames].sort()) {
      if (role !== schema.owner) {
        statements.push(`revoke all privileges on schema ${schemaIdentifier} from ${quoteIdentifier(role)};`)
      }
    }
    statements.push(`alter schema ${schemaIdentifier} owner to ${quoteIdentifier(schema.owner)};`)

    for (const grant of schema.grants) {
      if (!grant || typeof grant.grantee !== 'string'
        || !['USAGE', 'CREATE'].includes(grant.privilege)
        || typeof grant.grantable !== 'boolean') invalid()
      if (grant.grantee === schema.owner) continue
      if (grant.grantee !== 'PUBLIC' && !roleNames.has(grant.grantee)) invalid()
      const grantee = grant.grantee === 'PUBLIC' ? 'public' : quoteIdentifier(grant.grantee)
      const grantOption = grant.grantable ? ' with grant option' : ''
      statements.push(
        `grant ${grant.privilege} on schema ${schemaIdentifier} to ${grantee}${grantOption};`,
      )
    }
  }
  statements.push('commit;')
  return `${statements.join('\n')}\n`
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== 'restore-sql') invalid()
  const snapshot = await readFile(process.argv[3], 'utf8')
  process.stdout.write(buildSchemaAclRestoreSql(snapshot))
}

if (process.argv[1]?.endsWith('/supabase-runtime-schema-acl.mjs')) {
  void main().catch(() => {
    process.stderr.write('SUPABASE_RUNTIME_SCHEMA_ACL status=FAIL reason=snapshot_invalid\n')
    process.exitCode = 1
  })
}
