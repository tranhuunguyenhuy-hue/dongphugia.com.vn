import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const publisher = readFileSync('.github/workflows/preview-public-admin.yml', 'utf8')
const caller = readFileSync('.github/workflows/migration-preview.yml', 'utf8')

describe('integrated Preview credential boundary', () => {
  it('reuses the existing shared Preview token and fails closed when it is missing', () => {
    expect(publisher).not.toContain('CLOUDFLARE_PHASE2_PREVIEW_TOKEN')
    expect(publisher).not.toContain('environment: phase2-preview')
    expect(publisher.match(/Missing CLOUDFLARE_LEO563_PREVIEW_TOKEN repository secret/g)).toHaveLength(3)
    expect(caller).toContain('CLOUDFLARE_LEO563_PREVIEW_TOKEN: ${{ secrets.CLOUDFLARE_LEO563_PREVIEW_TOKEN }}')
    expect(caller).not.toContain('secrets: inherit')
    expect(caller).toContain('secrets.CLOUDFLARE_READONLY_DISCOVERY_TOKEN')
    expect(publisher).toContain('attest-scope')
    expect(caller).toContain("EVENT_ACTION\" == 'labeled'")
    expect(caller).toContain('test "$(jq -r \'.head.sha\' <<< "$pr_json")" = "$SOURCE_SHA"')
  })
})
