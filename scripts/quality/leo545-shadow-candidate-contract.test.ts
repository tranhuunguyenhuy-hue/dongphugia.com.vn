import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const candidate = JSON.parse(readFileSync(resolve(root, 'docs/deploy/leo-545-shadow-candidate-contract.json'), 'utf8'))
const workflow = readFileSync(resolve(root, '.github/workflows/migration-preview.yml'), 'utf8')
const staticContract = readFileSync(resolve(root, 'scripts/static-build/preview-artifact-contract.mts'), 'utf8')
const runtimeConfig = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')

describe('LEO-545 shadow candidate contract', () => {
  it('binds the approved isolated target, frozen side effects, and AWS rollback boundary', () => {
    expect(candidate).toMatchObject({
      contract: 'dongphugia:shadow-candidate:v1',
      environment: 'preview',
      supabase: { project: 'dongphugia-runtime', ref: 'tlmgudfhsyzayiazuugf', region: 'ap-southeast-1', schema: 'dpg_app' },
      sideEffects: { staticBuildSource: 'read-only-non-production', productionWritesAllowed: false, syntheticWrites: 'not-executed-by-candidate-assembly' },
    })
    expect(candidate.rollback.productionAuthority).toContain('AWS')
    expect(candidate.exclusions).toEqual(expect.arrayContaining(['LEO-543 scheduler', 'LEO-553 scheduler bridge and Publishing parity', 'LEO-544 media upload or transform pipeline', 'new Blog Publishing automation']))
  })

  it('binds only accepted JWT-protected runtime endpoints and source-side preservation checks', () => {
    for (const name of candidate.runtime.functions) {
      expect(runtimeConfig).toMatch(new RegExp(`\\[functions\\.${name}\\][\\s\\S]*?verify_jwt = true`))
    }
    for (const marker of ['PREVIEW_ARTIFACT_BLOG_PRESERVATION_FAILED', 'PREVIEW_ARTIFACT_BUNNY_PRESERVATION_FAILED', 'PREVIEW_ARTIFACT_BUNNY_REFERENCE_FAILED', 'shadowContractSha256']) {
      expect(staticContract).toContain(marker)
    }
  })

  it('fails closed rather than creating a missing Pages project', () => {
    expect(workflow).toContain('configured Preview project does not already exist')
    expect(workflow).not.toContain('pages project create')
    expect(workflow).not.toContain('PRODUCTION_DATABASE_URL')
  })
})
