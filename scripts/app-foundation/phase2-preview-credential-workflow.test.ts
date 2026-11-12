import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const publisher = readFileSync('.github/workflows/preview-public-admin.yml', 'utf8')
const caller = readFileSync('.github/workflows/migration-preview.yml', 'utf8')

describe('integrated Preview credential boundary', () => {
  it('uses the dedicated environment in each publisher job and fails closed if its secret is missing', () => {
    expect(publisher.match(/environment: phase2-preview/g)).toHaveLength(3)
    expect(publisher.match(/Missing CLOUDFLARE_PHASE2_PREVIEW_TOKEN in GitHub environment phase2-preview/g)).toHaveLength(3)
    expect(publisher).not.toContain('CLOUDFLARE_LEO563_PREVIEW_TOKEN')
    expect(caller).not.toContain('CLOUDFLARE_LEO563_PREVIEW_TOKEN')
    expect(caller).toContain('secrets.CLOUDFLARE_READONLY_DISCOVERY_TOKEN')
    expect(publisher).toContain('attest-scope')
    expect(caller).toContain("EVENT_ACTION\" == 'labeled'")
  })
})
