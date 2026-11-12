import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/migration-preview.yml'), 'utf8')
const reusablePublisher = readFileSync(resolve(process.cwd(), '.github/workflows/preview-public-admin.yml'), 'utf8')
const fullPreviewWorkflow = `${workflow}\n${reusablePublisher}`
const qualityWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/quality.yml'), 'utf8')
const buildGuide = readFileSync(resolve(process.cwd(), 'docs/deploy/public-static-build.md'), 'utf8')
const changeGate = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/preview-change-gate.mjs'), 'utf8')
const candidateScript = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/preview-candidate.mts'), 'utf8')
const cloudflareDiscovery = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/cloudflare-readonly-discovery.mjs'), 'utf8')
const previewPublication = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/cloudflare-preview-publication.mjs'), 'utf8')
const realPreviewProof = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/real-preview-proof.mjs'), 'utf8')

describe('migration PR CI and Preview workflow contract', () => {
  it('keeps general CI in quality.yml and only runs Preview/risk-specific checks here', () => {
    for (const marker of [
      'pull_request:',
      'branches: [main]',
      'fetch-depth: 0',
      'github.event.pull_request.head.sha || github.sha',
      'npm run static:check',
      'actions/upload-artifact@v4',
      "needs.repo-code-gate.outputs.ci_required == 'true'",
      "needs.repo-code-gate.outputs.integration_required == 'true'",
      "needs.repo-code-gate.outputs.b11_required == 'true'",
    ]) expect(workflow).toContain(marker)
    for (const general of ['npm run lint', 'npm run typecheck', 'npm test']) {
      expect(qualityWorkflow).toContain(general)
    }
    expect(workflow).not.toContain('run: npm run lint')
    expect(workflow).not.toContain('run: npm run typecheck\n')
    expect(workflow).toContain('Database, Auth and commerce integration tests')
    expect(workflow).toContain('run: npm test')
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
    const stateCheckStart = reusablePublisher.indexOf('name: Inspect the current Worker state before publication')
    const bootstrapStart = reusablePublisher.indexOf('name: Bootstrap absent, reconcile incomplete, or reuse managed active Preview')
    const versionUploadStart = reusablePublisher.indexOf('name: Upload one immutable Worker version with the approved PR Preview alias')
    const stateCheckEnd = reusablePublisher.indexOf('\n\n      - name:', stateCheckStart)
    const stateCheckStep = reusablePublisher.slice(stateCheckStart, stateCheckEnd)
    const bootstrapEnd = reusablePublisher.indexOf('\n\n      - name:', bootstrapStart)
    const bootstrapStep = reusablePublisher.slice(bootstrapStart, bootstrapEnd)

    expect(stateCheckStart).toBeGreaterThanOrEqual(0)
    expect(bootstrapStart).toBeGreaterThan(stateCheckStart)
    expect(versionUploadStart).toBeGreaterThan(bootstrapStart)
    expect(stateCheckStep).toContain('inspect-resource-state')
    for (const marker of [
      'ABSENT',
      'INCOMPLETE',
      'MANAGED_ACTIVE_PREVIEW',
      'MANAGED_BASELINE_ATTESTED',
      'reconciliationAllowed',
      'node "$WRANGLER_BIN" deploy',
      '--strict',
      '--config wrangler.preview.json',
      'bootstrap source $SOURCE_SHA',
      'CLOUDFLARE_PHASE2_PREVIEW_TOKEN',
    ]) expect(bootstrapStep).toContain(marker)
  })

  it('records a write attempt and distinguishes pre-publication from current-attempt failure inspection', () => {
    const bootstrapStart = reusablePublisher.indexOf('name: Bootstrap absent, reconcile incomplete, or reuse managed active Preview')
    const versionUploadStart = reusablePublisher.indexOf('name: Upload one immutable Worker version with the approved PR Preview alias')
    const postFailureStart = reusablePublisher.indexOf('name: Inspect the Worker state after a failed publication or runtime gate')
    const postFailureEnd = reusablePublisher.indexOf('\n\n      - name:', postFailureStart)
    const postFailureStep = reusablePublisher.slice(postFailureStart, postFailureEnd)

    expect(bootstrapStart).toBeGreaterThanOrEqual(0)
    expect(versionUploadStart).toBeGreaterThan(bootstrapStart)
    expect(postFailureStart).toBeGreaterThan(versionUploadStart)
    expect(reusablePublisher).toContain('id: bootstrap_write')
    expect(reusablePublisher).toContain('id: version_upload')
    expect(reusablePublisher).toContain('write_attempted=true')
    expect(reusablePublisher).toContain("steps.bootstrap_write.outputs.write_attempted == 'true'")
    expect(reusablePublisher).toContain("steps.version_upload.outputs.write_attempted == 'true'")
    expect(postFailureStep).toContain('failure()')
    expect(postFailureStep).toContain('inspect-resource-state')
    expect(postFailureStep).toContain('post-failure-remote-state.json')
    expect(postFailureStep).toContain('--expected-resource-proof')
    expect(postFailureStep).toContain('--upload')
    expect(postFailureStep).toContain('CLOUDFLARE_PHASE2_PREVIEW_TOKEN')
    expect(reusablePublisher).toContain('${{ env.EVIDENCE_DIR }}/post-failure-remote-state.json')
    expect(reusablePublisher).toContain('--preflight "$EVIDENCE_DIR/remote-preflight.json"')
    expect(reusablePublisher).toContain('--bootstrap-log "$EVIDENCE_DIR/bootstrap-deploy.log"')
  })

  it('writes the Worker secret into a new file inside a private temporary directory', () => {
    const uploadStart = reusablePublisher.indexOf('name: Upload one immutable Worker version with the approved PR Preview alias')
    const uploadEnd = reusablePublisher.indexOf('\n\n      - name:', uploadStart)
    const uploadStep = reusablePublisher.slice(uploadStart, uploadEnd)

    expect(uploadStep).toContain('umask 077')
    expect(uploadStep).toContain('secrets_dir="$(mktemp -d "${RUNNER_TEMP}/phase2-preview-worker-secrets.XXXXXX")"')
    expect(uploadStep).toContain('secrets_file="${secrets_dir}/worker-secrets.json"')
    expect(uploadStep).toContain('flag: "wx"')
    expect(uploadStep).toContain("trap 'rm -f \"$secrets_file\"; rmdir \"$secrets_dir\"' EXIT")
    expect(uploadStep).not.toContain('mktemp "${RUNNER_TEMP}/phase2-preview-worker-secrets.XXXXXX.json"')
  })

  it('uses the current isolated Worker read-back instead of pinned historical version IDs', () => {
    for (const marker of [
      'MANAGED_BASELINE_ATTESTED',
      'validateManagedBaselineState(currentState)',
      'latestVersionId: versions.items?.[0]?.id ?? null',
      'versions.items?.[0]?.id ?? null',
    ]) expect(`${fullPreviewWorkflow}\n${previewPublication}`).toContain(marker)

    expect(previewPublication).not.toContain('OWNER_RECONCILED_MANAGED_BASELINE')
    expect(previewPublication).not.toContain('0245f76f-e599-437b-862e-0599fe2b1f39')
    expect(previewPublication).not.toContain('6e7022d5-5f4d-4f51-8ab3-01850503a711')
  })

  it('skips unrelated changes before the candidate and external Preview path', () => {
    for (const marker of [
      'APPLICATION_SOURCE_PREFIXES',
      'apps/public/',
      'apps/admin/',
      'packages/app-contracts/',
      'preview_required',
      'SKIPPED_UNRELATED_CHANGE',
      'Non-artifact changes cannot reach the application candidate or Cloudflare publication path.',
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
    ]) expect(fullPreviewWorkflow.toLowerCase()).not.toContain(forbidden.toLowerCase())

    for (const marker of [
      "\"$ACTOR\" == 'tranhuunguyenhuy-hue'",
      "pr_number='${{ github.event.pull_request.number }}'",
      'gh api "repos/$REPOSITORY/pulls/$pr_number"',
      "test \"$(jq -r '.head.sha' <<< \"$pr_json\")\" = \"$SOURCE_SHA\"",
      'Re-verify the complete candidate identity before any Cloudflare mutation',
      'npm run app:verify-candidate',
      'npm run app:preview-publication -- preflight',
      'versions upload',
      '--preview-alias "pr-$PR_NUMBER"',
      'REAL_PUBLIC_PREVIEW_PASS',
      'admin-preview-upload:',
      'REAL_ADMIN_PREVIEW_PASS',
      'BLOCKED_BY_WORKERS_COST_OR_QUOTA',
      'PREVIEW_DEPLOYED',
      'CLOUDFLARE_PHASE2_PREVIEW_TOKEN',
    ]) expect(fullPreviewWorkflow).toContain(marker)

    expect(reusablePublisher.match(/versions upload/g)).toHaveLength(2)
    expect(reusablePublisher.match(/^\s+PR_NUMBER: \$\{\{ inputs\.pull_request_number \}\}$/gm)).toHaveLength(2)
    expect(reusablePublisher.match(/secrets\.CLOUDFLARE_PHASE2_PREVIEW_TOKEN/g)?.length).toBeGreaterThanOrEqual(10)
    expect(workflow.match(/secrets\.CLOUDFLARE_READONLY_DISCOVERY_TOKEN/g)).toHaveLength(1)
    expect(fullPreviewWorkflow).not.toContain('secrets.CLOUDFLARE_API_TOKEN')
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
    expect(fullPreviewWorkflow).not.toContain('BLOCKED_BY_OWNER_GATE')
    expect(workflow).toContain('CI_PASS_PREVIEW_NOT_DEPLOYED')
    expect(workflow).toContain("needs.cloudflare-readonly-discovery.outputs.workers_plan_status == 'FREE'")
    expect(`${workflow}\n${candidateScript}`).toContain('productionCustomDomain:')
    expect(`${workflow}\n${candidateScript}`).toContain('productionDnsOrTraffic:')

    for (const marker of [
      "const WORKER_NAME = 'dongphugia-v1-public-preview'",
      'const PREVIEW_ALIAS = `pr-${PREVIEW_PR_NUMBER}`',
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
    expect(realPreviewProof).toContain("contract: 'dongphugia:real-public-preview-proof:v2'")
    expect(realPreviewProof).toContain('directives.includes(PREVIEW_ROBOTS_REQUIRED_DIRECTIVE)')
    expect(realPreviewProof).not.toContain('PREVIEW_ROBOTS_HEADER)')
  })

  it('requires the Owner exact-SHA Preview label before any Cloudflare upload', () => {
    expect(workflow).not.toContain('workflow_dispatch:')
    expect(workflow).toContain('EVENT_ACTION: ${{ github.event.action || \'\' }}')
    expect(workflow).toContain('EVENT_LABEL: ${{ github.event.label.name || \'\' }}')
    expect(workflow).toContain('approved_label_present=')
    expect(workflow).toContain("if [[ \"$EVENT_ACTION\" == 'labeled' && \"$EVENT_LABEL\" == 'preview-approved' && \"$ACTOR\" == 'tranhuunguyenhuy-hue' ]]; then")
    expect(workflow).not.toContain('gh api --paginate --slurp')
    expect(workflow).not.toContain('label_events=')
    expect(workflow).toContain("test \"$(jq -r '.head.sha' <<< \"$pr_json\")\" = \"$SOURCE_SHA\"")
    expect(workflow).toContain('owner_approved_upload=true')
    expect(workflow).toContain("uses: ./.github/workflows/preview-public-admin.yml")
    expect(reusablePublisher).toContain('workflow_call:')
  })

  it('keeps the temporary order-intake diagnostic exact-SHA, Free-only, nonpersistent, and always cleaned up', () => {
    const diagnosticJobStart = reusablePublisher.indexOf('  order-intake-diagnostic:')
    const diagnosticJob = reusablePublisher.slice(diagnosticJobStart)
    const normalizedDiagnosticJob = diagnosticJob.replace(/\\/g, ' ').replace(/\s+/g, ' ')
    for (const marker of [
      "run_order_intake_diagnostic == true",
      "inputs.workers_plan_status == 'FREE'",
      "needs.public-preview-upload.outputs.result == 'REAL_PUBLIC_PREVIEW_PASS'",
      "needs.admin-preview-upload.outputs.result == 'REAL_ADMIN_PREVIEW_PASS'",
      'ref: ${{ inputs.source_sha }}',
      'actions/download-artifact@v4',
      'npm run app:verify-candidate',
      'attest-scope',
      'preflight',
      'wrangler.diagnostic.json',
      'node "$WRANGLER_BIN" tail "$WORKER_NAME" --format json --method GET',
      '--search PUBLIC_ORDER_INTAKE_DIAGNOSTIC',
      'exact source $SOURCE_SHA temporary receipt diagnostic',
      "steps.deploy.outputs.write_attempted == 'true'",
      'order-intake-diagnostic.mjs cleanup',
      "diagnostic_result='DIAGNOSTIC_CLEANUP_FAILED'",
      'no Version URL used',
      'no order POST or order write',
    ]) expect(normalizedDiagnosticJob, `Missing diagnostic workflow marker: ${marker}`).toContain(marker)
    expect(diagnosticJob).not.toContain('--sampling-rate')
    expect(diagnosticJob).not.toContain('--preview-alias')
    expect(diagnosticJob).not.toContain('workers_dev: false')
    expect(diagnosticJob).toContain("--config wrangler.diagnostic.json")
    expect(reusablePublisher).toContain('run_order_intake_diagnostic:')
    expect(reusablePublisher).toContain('order_intake_diagnostic_result:')
  })

  it('limits order-intake diagnostics to the exact isolated account, APP_ORIGIN allowlist, and no-persistence telemetry', () => {
    const diagnosticHelper = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/order-intake-diagnostic.mjs'), 'utf8')
    const edgeHandler = readFileSync(resolve(process.cwd(), 'supabase/functions/order-intake/handler.ts'), 'utf8')
    for (const marker of [
      "const APPROVED_ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'",
      "const APPROVED_SUPABASE_INTAKE_URL = 'https://uybumsnyqpwcidjxmfsv.supabase.co/functions/v1/order-intake'",
      'config.account_id = APPROVED_ACCOUNT_ID',
      'config.workers_dev = true',
      'config.preview_urls = false',
      'APP_ORIGIN: previewUrl',
      'invocation_logs: false',
      'persist: false',
      'traces: {\n      enabled: false,\n      persist: false,',
      'ORDER_DIAGNOSTIC_CLEANUP_PASS',
    ]) expect(diagnosticHelper).toContain(marker)
    expect(edgeHandler).toContain('^pr-[0-9]+-dongphugia-v1-public-preview\\.tranhuunguyenhuy\\.workers\\.dev$')
  })
})
