import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/migration-preview.yml'), 'utf8')
const buildGuide = readFileSync(resolve(process.cwd(), 'docs/deploy/public-static-build.md'), 'utf8')
const changeGate = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/preview-change-gate.mjs'), 'utf8')
const candidateScript = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/preview-candidate.mts'), 'utf8')
const cloudflareDiscovery = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/cloudflare-readonly-discovery.mjs'), 'utf8')
const previewPublication = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/cloudflare-preview-publication.mjs'), 'utf8')
const realPreviewProof = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/real-preview-proof.mjs'), 'utf8')

describe('migration PR CI and Preview workflow contract', () => {
  it('runs required repository CI against the exact PR head', () => {
    for (const marker of [
      'pull_request:',
      'branches: [main]',
      'fetch-depth: 0',
      'github.event.pull_request.head.sha || github.sha',
      'npm run lint',
      'npm run typecheck',
      'npm test',
      'npm run static:check',
      'actions/upload-artifact@v4',
    ]) expect(workflow).toContain(marker)
  })

  it('builds both independent deployables and verifies immutable identities', () => {
    for (const marker of [
      'app-preview-artifact:',
      'npm run build:public-worker',
      'npm run build:admin',
      'app:collect-artifact',
      'app:create-candidate',
      'app:verify-candidate',
      'Prove deterministic Admin artifact identity',
      'sourceCommit',
      'publicArtifactSha256',
      'adminArtifactSha256',
      'artifact_ready=true',
      'noindex',
    ]) expect(`${workflow}\n${candidateScript}`).toContain(marker)

    expect(buildGuide).toContain('Worker/assets/config identities')
    expect(buildGuide).toContain('CI-only')
  })

  it('preserves hidden files when transporting the immutable candidate', () => {
    const candidateUploadStart = workflow.indexOf('name: Upload the immutable Public/Admin candidate and evidence')
    const candidateUploadEnd = workflow.indexOf('\n\n  cloudflare-readonly-discovery:', candidateUploadStart)
    const candidateUpload = workflow.slice(candidateUploadStart, candidateUploadEnd)

    expect(candidateUpload).toContain('uses: actions/upload-artifact@v4')
    expect(candidateUpload).toContain('include-hidden-files: true')
  })

  it('bootstraps only an absent Worker, reconciles incomplete state, or reuses a verified managed Preview before version upload', () => {
    const stateCheckStart = workflow.indexOf('name: Inspect the current Worker state before publication')
    const bootstrapStart = workflow.indexOf('name: Bootstrap absent, reconcile incomplete, or reuse managed active Preview')
    const versionUploadStart = workflow.indexOf('name: Upload one immutable Worker version with the PR #138 Preview alias')
    const stateCheckEnd = workflow.indexOf('\n\n      - name:', stateCheckStart)
    const stateCheckStep = workflow.slice(stateCheckStart, stateCheckEnd)
    const bootstrapEnd = workflow.indexOf('\n\n      - name:', bootstrapStart)
    const bootstrapStep = workflow.slice(bootstrapStart, bootstrapEnd)

    expect(stateCheckStart).toBeGreaterThanOrEqual(0)
    expect(bootstrapStart).toBeGreaterThan(stateCheckStart)
    expect(versionUploadStart).toBeGreaterThan(bootstrapStart)
    expect(stateCheckStep).toContain('inspect-resource-state')
    for (const marker of [
      'ABSENT',
      'INCOMPLETE',
      'MANAGED_ACTIVE_PREVIEW',
      'reconciliationAllowed',
      'node "$WRANGLER_BIN" deploy',
      '--strict',
      '--config wrangler.preview.json',
      'bootstrap source $SOURCE_SHA',
      'CLOUDFLARE_LEO563_PREVIEW_TOKEN',
    ]) expect(bootstrapStep).toContain(marker)
  })

  it('records a write attempt and distinguishes pre-publication from current-attempt failure inspection', () => {
    const bootstrapStart = workflow.indexOf('name: Bootstrap absent, reconcile incomplete, or reuse managed active Preview')
    const versionUploadStart = workflow.indexOf('name: Upload one immutable Worker version with the PR #138 Preview alias')
    const postFailureStart = workflow.indexOf('name: Inspect the Worker state after a failed publication or runtime gate')
    const postFailureEnd = workflow.indexOf('\n\n      - name:', postFailureStart)
    const postFailureStep = workflow.slice(postFailureStart, postFailureEnd)

    expect(bootstrapStart).toBeGreaterThanOrEqual(0)
    expect(versionUploadStart).toBeGreaterThan(bootstrapStart)
    expect(postFailureStart).toBeGreaterThan(versionUploadStart)
    expect(workflow).toContain('id: bootstrap_write')
    expect(workflow).toContain('id: version_upload')
    expect(workflow).toContain('write_attempted=true')
    expect(workflow).toContain("steps.bootstrap_write.outputs.write_attempted == 'true'")
    expect(workflow).toContain("steps.version_upload.outputs.write_attempted == 'true'")
    expect(postFailureStep).toContain('failure()')
    expect(postFailureStep).toContain('inspect-resource-state')
    expect(postFailureStep).toContain('post-failure-remote-state.json')
    expect(postFailureStep).toContain('--expected-resource-proof')
    expect(postFailureStep).toContain('--upload')
    expect(postFailureStep).toContain('CLOUDFLARE_LEO563_PREVIEW_TOKEN')
    expect(workflow).toContain('${{ env.EVIDENCE_DIR }}/post-failure-remote-state.json')
    expect(workflow).toContain('--preflight "$EVIDENCE_DIR/remote-preflight.json"')
    expect(workflow).toContain('--bootstrap-log "$EVIDENCE_DIR/bootstrap-deploy.log"')
  })

  it('requires an exact prior LEO-563 evidence artifact before managed Preview reuse', () => {
    for (const marker of [
      'managed_preview_run_id',
      'managed_preview_source_sha',
      'managed_preview_bootstrap_version_id',
      'actions: read',
      'Download the exact prior LEO-563 Preview evidence for managed-state preflight',
      'run-id: ${{ needs.repo-code-gate.outputs.managed_preview_run_id }}',
      'name: leo563-real-public-preview-${{ needs.repo-code-gate.outputs.managed_preview_source_sha }}',
      'validate-managed-publication',
      '--managed-publication-proof "$EVIDENCE_DIR/managed-publication-proof.json"',
      '--bootstrap-version-id',
    ]) expect(workflow).toContain(marker)

    expect(workflow).toContain('MANAGED_PREVIEW_RUN_ID')
    expect(workflow).toContain('MANAGED_PREVIEW_SOURCE_SHA')
    expect(workflow).toContain('managed-publication-proof.json')
  })

  it('skips unrelated changes before the candidate and external Preview path', () => {
    for (const marker of [
      'APPLICATION_SOURCE_PREFIXES',
      'apps/public/',
      'apps/admin/',
      'packages/app-contracts/',
      'preview_required',
      'SKIPPED_UNRELATED_CHANGE',
      'DB/import/docs-only changes cannot reach the application candidate or Cloudflare publication path.',
    ]) expect(`${workflow}\n${changeGate}`).toContain(marker)
  })

  it('limits publication to the exact Owner-approved immutable Worker Preview path', () => {
    for (const forbidden of [
      'pages project create',
      'pages deploy',
      'cloudflare/wrangler-action',
      'wrangler deploy',
      'deployments: write',
      'PRODUCTION_DATABASE_URL',
      'cloudflared tunnel',
    ]) expect(workflow.toLowerCase()).not.toContain(forbidden.toLowerCase())

    for (const marker of [
      'publish_leo563_public_preview',
      'approved_source_sha',
      "refs/heads/codex/leo-563-public-admin-ci-foundation",
      'pulls/138',
      'test "$SOURCE_SHA" = "$APPROVED_SOURCE_SHA"',
      'Re-verify the complete candidate identity before any Cloudflare mutation',
      'npm run app:verify-candidate',
      'npm run app:preview-publication -- preflight',
      'versions upload',
      '--preview-alias pr-138',
      'REAL_PUBLIC_PREVIEW_PASS',
      'CLOUDFLARE_LEO563_PREVIEW_TOKEN',
    ]) expect(workflow).toContain(marker)

    expect(workflow.match(/versions upload/g)).toHaveLength(2)
    expect(workflow.match(/secrets\.CLOUDFLARE_LEO563_PREVIEW_TOKEN/g)).toHaveLength(5)
    expect(workflow.match(/secrets\.CLOUDFLARE_READONLY_DISCOVERY_TOKEN/g)).toHaveLength(1)
    expect(workflow).not.toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(workflow).toContain('cloudflare-readonly-discovery.mjs')
    expect(workflow).toContain('Mutating API methods and Wrangler publication: not invoked.')
    expect(cloudflareDiscovery).toContain("method: 'GET'")
    expect(cloudflareDiscovery).toContain('workers.versions.list:')
    expect(cloudflareDiscovery).toContain('workers.deployments.list:')
    expect(cloudflareDiscovery).toContain('versionIds')
    expect(cloudflareDiscovery).toContain('deploymentIds')
    for (const forbiddenMethod of ["method: 'POST'", "method: 'PUT'", "method: 'PATCH'", "method: 'DELETE'"]) {
      expect(cloudflareDiscovery).not.toContain(forbiddenMethod)
    }
    expect(workflow).toContain('BLOCKED_BY_OWNER_GATE')
    expect(`${workflow}\n${candidateScript}`).toContain('productionCustomDomain:')
    expect(`${workflow}\n${candidateScript}`).toContain('productionDnsOrTraffic:')

    for (const marker of [
      "const WORKER_NAME = 'dongphugia-v1-public-preview'",
      "const PREVIEW_ALIAS = 'pr-138'",
      'config.workers_dev !== false',
      'config.preview_urls !== true',
      "Object.hasOwn(config, 'limits')",
      'LEO563_PREVIEW_EXPLICIT_LIMITS_FORBIDDEN',
      'LEO563_PREVIEW_REMOTE_ACTIVE_DEPLOYMENT_FORBIDDEN',
      'LEO563_PREVIEW_MANAGED_VERSION_STATE_UNEXPECTED',
      'LEO563_PREVIEW_MANAGED_DEPLOYMENT_STATE_UNEXPECTED',
      'LEO563_PREVIEW_MANAGED_EVIDENCE_SOURCE_FAILED',
      'LEO563_PREVIEW_POST_FAILURE_VERSION_STATE_UNEXPECTED',
      'LEO563_PREVIEW_POST_FAILURE_DEPLOYMENT_STATE_UNEXPECTED',
      'LEO563_PREVIEW_PRODUCTION_HOST_FORBIDDEN',
      'LEO563_PREVIEW_REMOTE_BINDING_OR_ROUTE_FORBIDDEN',
    ]) expect(previewPublication).toContain(marker)
    expect(realPreviewProof).toContain("!url.hostname.endsWith('.workers.dev')")
  })
})
