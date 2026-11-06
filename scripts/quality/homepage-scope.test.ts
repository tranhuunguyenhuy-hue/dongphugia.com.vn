import { describe, expect, it } from 'vitest'
import { needsHomepageChecks, readHomepageImpact } from './homepage-scope.mjs'

describe('homepage CI risk-based scope', () => {
  it('skips documentation, staff-only, and backup-only changes', () => {
    for (const path of [
      'docs/PROJECT.md', 'AGENTS.md', 'apps/admin/app/page.tsx',
      'scripts/backup/create-encrypted-backup.sh',
      '.github/workflows/production-promotion.yml',
    ]) expect(needsHomepageChecks([path])).toBe(false)
  })

  it('runs on home UI, shared components, listing and performance changes', () => {
    for (const path of [
      'src/app/(public)/page.tsx', 'src/components/home/Hero.tsx',
      'src/components/layout/Footer.tsx', 'src/lib/catalogue.ts',
      'apps/public/app/page.tsx', 'public/banner.webp', 'prisma/schema.prisma',
      'playwright.homepage.config.ts', 'lighthouserc.toilet-listing.cjs',
      '.github/workflows/homepage-quality.yml', 'scripts/quality/homepage-scope.mjs',
    ]) expect(needsHomepageChecks([path])).toBe(true)
  })

  it('fails safe on unknown diff and runs full check for manual dispatch', () => {
    expect(needsHomepageChecks([])).toBe(true)
    expect(readHomepageImpact({ eventName: 'workflow_dispatch', baseSha: '' })).toBe(true)
    expect(readHomepageImpact({ eventName: 'pull_request', baseSha: 'invalid' })).toBe(true)
  })
})
