import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const policy = readFileSync(
  resolve(process.cwd(), 'docs/deploy/migration-free-tier-policy.md'),
  'utf8',
)
const docsIndex = readFileSync(resolve(process.cwd(), 'docs/README.md'), 'utf8')
const baseline = readFileSync(
  resolve(process.cwd(), 'docs/deploy/migration-implementation-baseline.md'),
  'utf8',
)
const searchablePolicy = policy.replace(/\s+/g, ' ')

describe('migration free-tier and Owner-gate policy', () => {
  it('is discoverable and anchored to the accepted proof and baseline', () => {
    expect(docsIndex).toContain('deploy/migration-free-tier-policy.md')
    expect(searchablePolicy).toContain('LEO-532')
    expect(searchablePolicy).toContain('LEO-531 evidence')
    expect(searchablePolicy).toContain('canonical migration implementation baseline')
    expect(baseline).toContain('LEO-531 feasibility audit')
  })

  it('locks the accepted budget and compatibility references', () => {
    for (const reference of [
      '350 MiB / 367,001,600 bytes',
      '250 MiB',
      '300 MiB',
      '4,093 files',
      '7,559,256 total bytes',
      '20,000 files',
      '25 MiB per file',
      '256 MB',
      '150 seconds',
      '2 seconds',
      'Sharp/libvips is unsupported',
      '5,000 unique transformations/month',
      '714 complete seven-variant sources/month',
      'pg_cron',
      'one-minute schedule model',
      'Bunny remains the existing media storage/CDN contract',
    ]) {
      expect(searchablePolicy).toContain(reference)
    }
  })

  it('requires fail-closed verification for mutable provider facts', () => {
    for (const requirement of [
      '`UNKNOWN`',
      'current provider documentation and the intended account/project plan',
      'current runtime limits',
      'account allowance',
      'current monthly usage or cost figure',
      'is `BLOCKED`',
    ]) {
      expect(searchablePolicy).toContain(requirement)
    }
  })

  it('defines every requested Owner approval boundary', () => {
    for (const gate of [
      'Production-derived external data placement',
      'Production database or write target',
      'Credential or security change',
      'DNS or traffic cutover',
      'Paid tier or overage',
      'Irreversible AWS deletion or retirement',
      'Owner approval',
      'LEO-538',
      'LEO-548',
      'LEO-550',
    ]) {
      expect(searchablePolicy).toContain(gate)
    }
  })

  it('keeps this policy source-only and non-authorizing', () => {
    for (const exclusion of [
      'performs no runtime, data, provider, credential, DNS, traffic,',
      'No policy in this document authorizes provisioning',
      'No credential access, rotation, or security mutation is part of LEO-532',
    ]) {
      expect(searchablePolicy).toContain(exclusion)
    }
  })
})
