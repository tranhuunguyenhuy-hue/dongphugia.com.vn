import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/admin-release-artifact-review.yml', 'utf8')
describe('combined Admin artifact review workflow', () => {
  it('uses trusted main to review data from one exact successful producer without provider credentials', () => {
    expect(workflow).toContain('github.ref == \'refs/heads/main\'')
    expect(workflow).toContain('"$SOURCE_SHA" == "$GITHUB_SHA"')
    expect(workflow).toContain('.path == ".github/workflows/combined-admin-build.yml"')
    expect(workflow).toContain('.head_sha == $sha')
    expect(workflow).toContain('.conclusion == "success"')
    expect(workflow).toContain('review-admin-release.mjs')
    const review = workflow.split('\n  publish:')[0]
    const publish = workflow.split('\n  publish:')[1]
    expect(review).not.toMatch(/secrets\.|CLOUDFLARE_API_TOKEN|DATABASE_URL|wrangler.*deploy/)
    expect(publish).toContain('environment: Production')
    expect(publish.indexOf('check-admin-release-protection.mjs')).toBeLessThan(publish.indexOf('secrets.CLOUDFLARE_API_TOKEN'))
    expect(publish).toContain('needs.review.outputs.artifact_sha256')
  })
})
