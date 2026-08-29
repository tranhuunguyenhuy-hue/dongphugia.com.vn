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
const canonicalScheduler = readFileSync(resolve(root, 'src/lib/publishing/scheduler.ts'), 'utf8')
const canonicalReadiness = readFileSync(resolve(root, 'src/lib/publishing/readiness.ts'), 'utf8')
const canonicalHtml = readFileSync(resolve(root, 'src/lib/publishing/html.ts'), 'utf8')
const leo542Runtime = readFileSync(resolve(root, 'supabase/migrations/20260828185021_leo542_admin_publishing_runtime.sql'), 'utf8')
const runbook = readFileSync(resolve(root, 'docs/deploy/leo553-preview-scheduler-bridge.md'), 'utf8')

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
    expect(migration).toContain("refresh_transport_status = case when v_published > 0 then 'pending' else 'not_required' end")
    expect(edge).toContain('shouldDispatchPreviewRefresh(result)')
    expect(migration).toContain("refresh_transport_status = 'pending'")
    expect(migration).toContain("set refresh_transport_status = 'dispatching'")
    expect(edge.match(/fetch\(LEO553_GITHUB_WORKFLOW_DISPATCH_URL/g)).toHaveLength(1)
  })

  it('makes duplicate publication and refresh dispatch idempotent', () => {
    expect(migration).toContain('run_id uuid primary key')
    expect(migration).toContain("hashtextextended('dongphugia:leo553:run:' || p_run_id::text")
    expect(migration).toContain("'refresh_required', v_existing.refresh_transport_status = 'pending'")
    expect(migration).toContain("refresh_transport_status = 'dispatching'")
    expect(workflow).toContain('cancel-in-progress: false')
  })

  it('executes privileged refresh code only from trusted main', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('refresh_id:')
    expect(workflow).not.toContain('repository_dispatch:')
    expect(workflow.match(/ref: refs\/heads\/main/g)).toHaveLength(2)
    expect(workflow).toContain("test \"$GITHUB_REF\" = 'refs/heads/main'")
    expect(workflow).toContain('test "$control_sha" = "$GITHUB_SHA"')
    expect(workflow).toContain('REFRESH_ID: ${{ inputs.refresh_id }}')
    expect(workflow.match(/\$\{\{ inputs\./g)).toHaveLength(1)
    expect(workflow).not.toMatch(/inputs\.(?:repository|workflow|ref|branch|environment|project|command)\b/)
    expect(workflow).not.toMatch(/checkout[^\n]*(?:ref|repository).*(?:github\.event|inputs)/i)
    expect(workflow).not.toMatch(/(?:bash|node|npm|npx)\s+[^\n]*(?:github\.event|REFRESH_ID)/i)
  })

  it('fixes the exact workflow and main ref and keeps Production unreachable', () => {
    expect(bridgeShared).toContain('/actions/workflows/preview-publishing-refresh.yml/dispatches')
    expect(bridgeShared).toContain("LEO553_GITHUB_WORKFLOW_REF = 'main'")
    expect(edge).toContain('ref: LEO553_GITHUB_WORKFLOW_REF')
    expect(edge).toContain('inputs: { refresh_id: input.run_id }')
    expect(edge).not.toMatch(/event_type|client_payload|repository_dispatch/)
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
    expect(migration).toContain("refresh_transport_status = case when p_accepted then 'accepted' else 'failed' end")
    expect(migration).toContain("refresh_completion_status = case")
    expect(migration).toContain("when p_accepted then 'external_evidence_required'")
    expect(migration).toContain('publishing_status text')
    expect(migration).toContain('github_workflow_run_id bigint')
    expect(edge).toContain('parseWorkflowDispatchRunId(await response.json())')
    expect(workflow).toContain('LEO553_REFRESH status=FAILED reason=TRUSTED_STATIC_REFRESH_FAILED')
    expect(workflow).not.toMatch(/echo[^\n]*(?:DATABASE_URL|CLOUDFLARE_API_TOKEN|LEO553_GITHUB_DISPATCH_TOKEN)/)
  })

  it('requires only repository Actions write and contains no content-write contract', () => {
    expect(runbook).toContain('repository `Actions: write`')
    expect(runbook).toContain('no `Contents: write`')
    expect(runbook).not.toContain('minimum API permission: repository `Contents: write`')
    expect(`${workflow}\n${edge}`).not.toMatch(/contents:\s*write/i)
    expect(edge).toContain("response.status === 200")
  })

  it('fails closed because accepted LEO-542 Supabase writes lack canonical safety parity', () => {
    for (const marker of [
      'verifyStoredSafety',
      'sanitizePublishingHtml',
      'MEDIA_ASSET_LIMIT_EXCEEDED',
      'CONTENT_HTML_NOT_CANONICAL',
    ]) expect(canonicalScheduler).toContain(marker)
    for (const marker of [
      'TITLE_LENGTH', 'EXCERPT_LENGTH', 'VISIBLE_CONTENT_LENGTH',
      'CATEGORY_INACTIVE', 'TAG_INACTIVE', 'THUMBNAIL_REQUIRED',
      'COVER_REQUIRED', 'MEDIA_REFERENCE_INVALID',
    ]) expect(canonicalReadiness).toContain(marker)
    for (const marker of [
      'HTML_TAG_NOT_ALLOWED', 'HTML_ATTRIBUTE_NOT_ALLOWED',
      'EXTERNAL_LINK_HTTPS_REQUIRED', 'EXTERNAL_LINK_HOST_NOT_ALLOWED',
    ]) expect(canonicalHtml).toContain(marker)

    expect(leo542Runtime).toContain("v_status:=coalesce(p_input->>'status','draft')")
    expect(leo542Runtime).not.toMatch(/HTML_TAG_NOT_ALLOWED|EXTERNAL_LINK_HOST_NOT_ALLOWED|MEDIA_ASSET_LIMIT_EXCEEDED/)
    expect(bridgeShared).toContain('LEO553_PUBLISHING_PARITY_APPROVED = false')
    expect(edge.indexOf('PUBLISHING_PARITY_UNRESOLVED')).toBeLessThan(
      edge.indexOf("client.rpc('leo553_scheduler_bridge'"),
    )
    expect(edge).toMatch(/result_code: 'PUBLISHING_PARITY_UNRESOLVED',[\s\S]*processed_count: 0,[\s\S]*published_count: 0,[\s\S]*blocked_count: 0/)
    expect(runbook).toContain('LEO-542 Supabase parity contradiction')
  })
})
