import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const deployName = 'publishing-api-v1-production-legacy-rls.sql'
const rollbackName = 'publishing-api-v1-production-legacy-rls-rollback.sql'
const deploy = readFileSync(resolve(process.cwd(), 'docs/deploy', deployName), 'utf8')
const rollback = readFileSync(resolve(process.cwd(), 'docs/deploy', rollbackName), 'utf8')
const deployManifest = readFileSync(resolve(process.cwd(), 'docs/deploy', `${deployName}.sha256`), 'utf8').trim()
const rollbackManifest = readFileSync(resolve(process.cwd(), 'docs/deploy', `${rollbackName}.sha256`), 'utf8').trim()

const policyNames = [
  'publishing_runtime_prod_categories_select',
  'publishing_runtime_prod_tags_select',
  'publishing_runtime_prod_tags_update_count',
  'publishing_runtime_prod_posts_select',
  'publishing_runtime_prod_posts_insert',
  'publishing_runtime_prod_posts_update',
  'publishing_runtime_prod_post_tags_select',
  'publishing_runtime_prod_post_tags_insert',
  'publishing_runtime_prod_post_tags_delete',
]

describe('Publishing API v1 production legacy RLS artifacts', () => {
  it('pins both reviewed artifacts', () => {
    expect(deployManifest).toBe(`${createHash('sha256').update(deploy).digest('hex')}  ${deployName}`)
    expect(rollbackManifest).toBe(`${createHash('sha256').update(rollback).digest('hex')}  ${rollbackName}`)
  })

  it('is parameterized, atomic, fail-closed, and least privilege', () => {
    for (const artifact of [deploy, rollback]) {
      expect(artifact).toContain('\\if :{?runtime_role}')
      expect(artifact).toContain('\\set ON_ERROR_STOP on')
      expect(artifact).toContain('SET LOCAL search_path = pg_catalog, public;')
      expect(artifact).toContain('BEGIN;')
      expect(artifact.trimEnd()).toMatch(/COMMIT;$/)
      expect(artifact).not.toMatch(/\bBYPASSRLS\b/)
      expect(artifact).not.toMatch(/\bGRANT\b/)
      expect(artifact).not.toMatch(/\bALTER\s+TABLE\b/)
      expect(artifact).not.toMatch(/\bDROP\s+TABLE\b/)
    }
    expect(deploy).toContain('NOT rolbypassrls')
    expect(deploy).toContain('Publishing legacy RLS found a partial or unexpected policy state')
    expect(deploy).toContain('Publishing legacy RLS postcondition failed')
  })

  it('limits legacy visibility and mutations to the Publishing-owned surface', () => {
    expect(deploy).toContain('blog_categories FOR SELECT')
    expect(deploy).toContain('blog_tags FOR SELECT')
    expect(deploy).toContain('blog_tags FOR UPDATE')
    expect(deploy).toContain('blog_categories FOR SELECT TO %I USING (true)')
    expect(deploy).toContain('blog_tags FOR SELECT TO %I USING (true)')
    expect(deploy).toContain('blog_tags FOR UPDATE TO %I USING (true) WITH CHECK (true)')
    expect(deploy).toContain('blog_posts FOR SELECT')
    expect(deploy).toContain('blog_posts FOR INSERT')
    expect(deploy).toContain('blog_posts FOR UPDATE')
    expect(deploy).toContain('publishing_identity_id IS NOT NULL')
    expect(deploy).toContain('blog_post_tags FOR DELETE')
    expect(deploy).toContain('blog_post_tags FOR SELECT TO %I USING (true)')
    expect(deploy).not.toContain('blog_posts FOR DELETE')
    expect(deploy).not.toContain('blog_categories FOR UPDATE')
  })

  it('rolls back exactly every deployed policy', () => {
    for (const policyName of policyNames) {
      expect(deploy).toContain(`CREATE POLICY ${policyName}`)
      expect(rollback).toContain(`DROP POLICY ${policyName}`)
    }
    expect(rollback.match(/DROP POLICY /g)).toHaveLength(policyNames.length)
    expect(rollback).toContain('exact nine-policy target state')
  })
})
