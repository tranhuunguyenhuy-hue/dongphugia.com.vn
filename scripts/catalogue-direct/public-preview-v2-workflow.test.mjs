import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const workflow=readFileSync('.github/workflows/catalogue-public-preview-v2.yml','utf8')

it('builds one protected read-only source candidate before any possible Worker upload',()=>{
 const order=['Verify execution tuple','Record Preview-only billing as unverified',
  'Build canonical Public Worker without database credentials','Generate public-only assets from the independently verified target',
  'Prerender canonical catalogue HTML and Flight within bounded Free assets',
  'Verify Public-only artifact, real snapshot identity and Free caps',
  'Preserve the immutable Public-only candidate before any provider write',
  'Confirm Workers Free plan automatically before upload','Create a fresh read-only managed-state receipt and immediately recheck it',
  'Upload one existing Worker version']
 let previous=-1
 for(const step of order){const index=workflow.indexOf(`- name: ${step}`);expect(index).toBeGreaterThan(previous);previous=index}
 expect(workflow).toContain("DIRECT_PUBLIC_PREVIEW_PUBLISH: 'false'")
 expect(workflow).toContain('DIRECT_TARGET_READ_DATABASE_URL: ${{ secrets.DIRECT_TARGET_READ_DATABASE_URL }}')
 expect(workflow).not.toContain('DIRECT_ZERO_COST_PREVIEW_PUBLICATION_EVIDENCE')
 expect(workflow).not.toContain('DIRECT_ZERO_COST_CANDIDATE_EVIDENCE')
 expect(workflow).not.toContain('DIRECT_CLOUDFLARE_FREE_ATTESTATION')
 expect(workflow).toContain('billing-status.json')
 expect(workflow).toContain('preview2-candidate-audit.mjs "$ARTIFACT_ROOT/build"')
 expect(workflow).not.toContain('DIRECT_VAULT_TOKEN')
 expect(workflow).not.toContain('wrangler deploy ')
 expect(workflow).not.toContain('DIRECT_CHECKPOINT_AGE_IDENTITY')
 expect(workflow).toContain('github.run_attempt == 1 && inputs.approved_sha == github.sha')
})

it('pins the newly read managed baseline and excludes write on candidate-only run',()=>{
 expect(workflow).toContain('--expected-version-count 12')
 expect(workflow).toContain('--expected-latest-version-id 49c91111-a0c6-4d3b-9db6-cfa318a9bf4a')
 expect(workflow).toContain('--bootstrap-version-id d4658ffa-2fcd-465b-bae7-7967bb1c7f78')
 expect(workflow).toContain('and .path==".github/workflows/catalogue-public-preview-v2.yml"')
 expect(workflow).toMatch(/- name: Upload one existing Worker version\n\s+if: inputs\.publish/)
 expect(workflow).toContain('[[ "${{ inputs.allow_candidate_build }}" == true && "${{ inputs.publish }}" == false ]]')
 expect(workflow).toContain('[[ -n "$ARTIFACT_RUN_ID" ]]')
 expect(workflow).toContain('reconcile-progress')
 expect(workflow).toContain('compare-builds')
 expect(workflow).toContain('validate-managed-publication')
})
