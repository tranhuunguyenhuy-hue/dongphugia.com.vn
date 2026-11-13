import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const file=(p: string)=>readFileSync(resolve(process.cwd(),p),'utf8')
describe('V1 fast deployment is the only active release path',()=>{
  it('uses real Public Worker build and exact Worker deployment identity',()=>{
    const s=file('.github/workflows/v1-worker-release.yml')
    expect(s).toContain('workflow_dispatch:')
    expect(s).toContain('default: false')
    expect(s).toContain('refs/heads/main')
    expect(s).toContain('build:public-worker')
    expect(s).toContain('app:assemble-public-worker')
    expect(s).toContain('wrangler.production.jsonc')
    expect(s).toContain('dongphugia-v1-public-production')
    expect(s).toContain('deploy --dry-run')
    expect(s).toContain('if: inputs.publish')
    expect(s).toContain('CLOUDFLARE_API_TOKEN')
    expect(s).toContain('https://www.dongphugia.vn')
    expect(s).not.toContain('WORKER_SELF_REFERENCE')
  })
  it('keeps expensive unrelated CI optional and one quality gate required',()=>{
    const q=file('.github/workflows/quality.yml')
    expect(q).toContain('name: quality')
    expect(q).toContain('run_app_checks')
    expect(q).toContain('if: needs.scope.outputs.run_app_checks')
    for(const p of [
      '.github/workflows/environment-worker-ci.yml',
      '.github/workflows/pr-preview-build.yml',
      '.github/workflows/pr-preview-cleanup.yml',
      '.github/workflows/pr-preview-publish.yml',
      '.github/workflows/homepage-quality.yml'
    ]){
      const s=file(p)
      expect(s).toContain('workflow_dispatch:')
      expect(s).not.toMatch(/\n  pull_request_target:\n|\n  pull_request:\n|\n  workflow_run:\n|\n  push:\n/)
    }
  })
})