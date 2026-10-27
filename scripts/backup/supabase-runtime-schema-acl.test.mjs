import { describe, expect, it } from 'vitest'

import { buildSchemaAclRestoreSql } from './supabase-runtime-schema-acl.mjs'

const snapshot = {
  format: 'dpg-runtime-schema-acl-v1',
  roles: ['anon', 'authenticated', 'postgres', 'supabase_admin'],
  schemas: [
    {
      name: 'auth',
      owner: 'supabase_admin',
      grants: [
        { grantee: 'supabase_admin', privilege: 'CREATE', grantable: true },
        { grantee: 'authenticated', privilege: 'USAGE', grantable: true },
      ],
    },
    {
      name: 'extensions',
      owner: 'postgres',
      grants: [
        { grantee: 'postgres', privilege: 'CREATE', grantable: true },
        { grantee: 'PUBLIC', privilege: 'USAGE', grantable: false },
      ],
    },
  ],
}

describe('Supabase runtime schema ACL snapshot', () => {
  it('recreates only the captured auth and extensions schema owners and grants', () => {
    const sql = buildSchemaAclRestoreSql(snapshot)

    expect(sql).toContain('alter schema "auth" owner to "supabase_admin";')
    expect(sql).toContain('grant USAGE on schema "auth" to "authenticated" with grant option;')
    expect(sql).toContain('grant USAGE on schema "extensions" to public;')
    expect(sql).not.toContain('grant CREATE on schema "auth" to "supabase_admin"')
    expect(sql).toContain('with grant option;')
    expect(sql).not.toContain('grant CREATE on schema "extensions" to "anon"')
  })

  it('rejects missing schemas, unknown roles, and privileges outside schema ACLs', () => {
    expect(() => buildSchemaAclRestoreSql({ ...snapshot, schemas: snapshot.schemas.slice(0, 1) }))
      .toThrow('schema_acl_snapshot_invalid')
    expect(() => buildSchemaAclRestoreSql({
      ...snapshot,
      schemas: snapshot.schemas.map((schema) => schema.name === 'auth'
        ? { ...schema, grants: [{ grantee: 'unknown', privilege: 'USAGE', grantable: false }] }
        : schema),
    })).toThrow('schema_acl_snapshot_invalid')
    expect(() => buildSchemaAclRestoreSql({
      ...snapshot,
      schemas: snapshot.schemas.map((schema) => schema.name === 'auth'
        ? { ...schema, grants: [{ grantee: 'anon', privilege: 'SELECT', grantable: false }] }
        : schema),
    })).toThrow('schema_acl_snapshot_invalid')
  })
})
