import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const workflow = readFileSync(resolve(root, '.github/workflows/preview-publishing-refresh.yml'), 'utf8')
const migration = readFileSync(resolve(root, 'supabase/migrations/20260829105009_leo553_trusted_preview_scheduler_bridge.sql'), 'utf8')
const edge = readFileSync(resolve(root, 'supabase/functions/publishing-scheduler/index.ts'), 'utf8')
const bridgeShared = readFileSync(resolve(root, 'supabase/functions/_shared/leo553.ts'), 'utf8')
const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')
const previewWorkflow = readFileSync(resolve(root, '.github/workflows/migration-preview.yml'), 'utf8')
const artifactContract = readFileSync(resolve(root, 'scripts/static-build/preview-artifact-contract.mts'), 'utf8')

describe('LEO-553 trusted scheduler bridge contract', () => {
  it('reuses the LEO-542 Publishing authority and emits only bounded results', () => {
    for (const marker of [
      "hashtextextended('leo542:publishing-global-gate'",
      "hashtextextended('leo542:publishing-identity:'",
      "c.capability = 'posts:publish'",
      'dpg_app.publishing_global_controls',
      'dpg_app.publishing_audit_events',
      "'post.scheduled_published'",
      "'post.schedule_blocked'",
    ]) expect(migration).toContain(marker)
    expect(migration).toContain('published_count + blocked_count <= processed_count')
    expect(migration).toContain('limit 100')
    expect(migration).toContain('leo553_scheduler_post_transition')
    expect(migration).toContain("with check (status in ('published', 'schedule_blocked')")
    expect(migration).toContain('leo553_scheduler_audit_insert')
    expect(migration.indexOf("hashtextextended('leo542:publishing-identity:'")).toBeLessThan(
      migration.indexOf('for update;', migration.indexOf("hashtextextended('leo542:publishing-identity:'")),
    )
    expect(migration).not.toContain('for update skip locked')
    expect(edge).toContain('parseLeo553BridgeResult')
    expect(edge).toContain('schedulerResponse(result)')
  })

  it('fails closed on missing or invalid machine authentication without a broad key', () => {
    expect(config).toMatch(/\[functions\.publishing-scheduler\]\nverify_jwt = false/)
    expect(edge).toContain("request.headers.get('x-publishing-scheduler-token')")
    expect(migration).toContain("where name = 'leo543_scheduler_token'")
    expect(migration).toContain("raise exception 'UNAUTHORIZED'")
    expect(`${edge}\n${migration}`).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEYS|service_role.*grant execute/i)
    expect(edge).not.toMatch(/console\.(?:log|error)\([^\n]*(?:token|githubToken)/i)
  })

  it('dispatches zero refreshes on no change and claims exactly one on change', () => {
    expect(migration).toContain("refresh_status = case when v_published > 0 then 'pending' else 'not_required' end")
    expect(edge).toContain('!result.refresh_required || result.published_count === 0')
    expect(migration).toContain("where run_id = p_run_id and refresh_status = 'pending' and published_count > 0")
    expect(migration).toContain("set refresh_status = 'dispatching'")
    expect(edge.match(/fetch\(LEO553_GITHUB_DISPATCH_URL/g)).toHaveLength(1)
  })

  it('makes duplicate publication and refresh dispatch idempotent', () => {
    expect(migration).toContain('run_id uuid primary key')
    expect(migration).toContain("hashtextextended('dongphugia:leo553:run:' || p_run_id::text")
    expect(migration).toContain("'refresh_required', v_existing.refresh_status = 'pending'")
    expect(migration).toContain("where run_id = p_run_id and refresh_status = 'dispatching'")
    expect(workflow).toContain('cancel-in-progress: false')
  })

  it('executes privileged refresh code only from trusted main', () => {
    expect(workflow).toContain('repository_dispatch:')
    expect(workflow).toContain('types: [leo553-preview-refresh]')
    expect(workflow).not.toContain('workflow_dispatch:')
    expect(workflow.match(/ref: refs\/heads\/main/g)).toHaveLength(2)
    expect(workflow).toContain("test \"$GITHUB_REF\" = 'refs/heads/main'")
    expect(workflow).toContain('test "$control_sha" = "$GITHUB_SHA"')
    expect(workflow).not.toMatch(/checkout[^\n]*(?:ref|repository).*(?:client_payload|inputs)/i)
    expect(workflow).not.toMatch(/(?:bash|node|npm|npx)\s+[^\n]*(?:client_payload|REFRESH_ID)/i)
  })

  it('rejects arbitrary target selection and keeps Production unreachable', () => {
    expect(bridgeShared).toContain("'https://api.github.com/repos/tranhuunguyenhuy-hue/dongphugia.com.vn/dispatches'")
    expect(edge).not.toMatch(/request.*(?:repository|ref|workflow|branch|target)/i)
    expect(workflow).toContain('--branch=publishing-refresh')
    expect(workflow).toContain('CLOUDFLARE_PAGES_PREVIEW_PROJECT')
    for (const forbidden of ['PRODUCTION_DATABASE_URL', 'production-promotion.yml', '--branch=main', 'pages project create', 'cloudflared tunnel']) {
      expect(workflow.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })

  it('preserves the canonical static artifact and existing PR Preview contracts', () => {
    for (const marker of [
      'npm run static:verify-preview-source',
      'npm run static:build -- --mode=preview',
      'npm run static:verify-preview',
      'PUBLIC_STATIC_BUILD_READ_ONLY',
      'PUBLIC_STATIC_BUILD_DB_ROLE: dpg_readonly',
      'noindex, nofollow',
      'noindex,nofollow',
      'Disallow: /',
    ]) expect(workflow).toContain(marker)
    expect(workflow).toContain('https://publishing-refresh.${PREVIEW_PROJECT}.pages.dev')
    expect(artifactContract).toContain("dongphugia:static-preview-candidate:v1")
    expect(previewWorkflow).toContain('pull_request:')
    expect(previewWorkflow).toContain('--branch=pr-${{ github.event.pull_request.number || github.run_id }}')
  })

  it('records dispatch and refresh failures with sanitized fixed codes', () => {
    expect(edge).toContain('PREVIEW_REFRESH_DISPATCH_FAILED')
    expect(migration).toContain("refresh_error_code = case when p_succeeded then null else 'GITHUB_DISPATCH_FAILED' end")
    expect(workflow).toContain('LEO553_REFRESH status=FAILED reason=TRUSTED_STATIC_REFRESH_FAILED')
    expect(workflow).not.toMatch(/echo[^\n]*(?:DATABASE_URL|CLOUDFLARE_API_TOKEN|LEO553_GITHUB_DISPATCH_TOKEN)/)
  })
})
