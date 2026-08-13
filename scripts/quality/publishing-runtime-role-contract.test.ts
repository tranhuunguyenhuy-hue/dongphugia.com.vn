import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const roleProvisioning = readFileSync(
  resolve(process.cwd(), 'docs/deploy/publishing-api-v1-runtime-role.sql'),
  'utf8',
)
const manifest = readFileSync(
  resolve(process.cwd(), 'docs/deploy/publishing-api-v1-runtime-role.sha256'),
  'utf8',
).trim()

describe('Publishing API v1 dedicated runtime role artifact', () => {
  it('creates only a fresh non-owner login with an owner-environment secret input', () => {
    expect(roleProvisioning).toContain('\\if :{?runtime_role}')
    expect(roleProvisioning).toContain('\\getenv runtime_password_verifier PUBLISHING_RUNTIME_PASSWORD_VERIFIER')
    expect(roleProvisioning).toContain('\\if :{?runtime_password_verifier}')
    expect(roleProvisioning).toContain('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS')
    expect(roleProvisioning).toContain('Publishing runtime role must not already exist')
    expect(roleProvisioning).toContain('SCRAM-SHA-256')
    expect(roleProvisioning).not.toContain('runtime_password=<secret>')
    expect(roleProvisioning).not.toContain('--set=runtime_password_verifier=')
    expect(roleProvisioning).not.toMatch(/ALTER\s+ROLE/i)
    expect(roleProvisioning).not.toMatch(/ALTER\s+OWNER/i)
    expect(roleProvisioning).not.toMatch(/GRANT\s+[^;]*\s+TO\s+PUBLIC/i)
  })

  it('pins the reviewed provisioning artifact', () => {
    const digest = createHash('sha256').update(roleProvisioning).digest('hex')
    expect(manifest).toBe(`${digest}  publishing-api-v1-runtime-role.sql`)
  })

  it('grants only the Publishing API CMS surface and verifies it fail-closed', () => {
    expect(roleProvisioning).not.toContain('public.admin_users')
    expect(roleProvisioning).toContain('GRANT UPDATE (post_count) ON TABLE public.blog_tags')
    expect(roleProvisioning).toContain('GRANT SELECT, INSERT, DELETE ON TABLE public.blog_post_tags')
    expect(roleProvisioning).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.blog_posts')
    expect(roleProvisioning).toContain('GRANT USAGE ON SEQUENCE public.blog_posts_id_seq')
    expect(roleProvisioning).toContain("('TRUNCATE'), ('REFERENCES'), ('TRIGGER')")
    expect(roleProvisioning).toContain('Publishing runtime role provisioning postcondition failed for CMS privileges')
    expect(roleProvisioning).toContain('SECURITY DEFINER')
    expect(roleProvisioning).toContain('publishing_touch_credential_last_used')
    expect(roleProvisioning).toContain('REVOKE ALL ON FUNCTION public.publishing_touch_credential_last_used(uuid) FROM PUBLIC')
    expect(roleProvisioning).toContain('privilege.grantee = 0')
    expect(roleProvisioning).not.toMatch(/GRANT\s+ALL/i)
  })
})
