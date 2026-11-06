import { describe, expect, it } from 'vitest'

import {
  classifyChangedPaths,
  isMaterialApplicationPath,
} from './preview-change-gate.mjs'

describe('LEO-563 repository-code Preview gate', () => {
  it('covers legacy Public UI and build assets in Preview candidates', () => {
    expect(classifyChangedPaths(['src/app/(public)/page.tsx'])).toMatchObject({
      publicChanged: true, previewRequired: true, ciRequired: true,
    })
    expect(classifyChangedPaths(['src/components/home/Hero.tsx']).previewRequired).toBe(true)
    expect(classifyChangedPaths(['public/banners/home.webp']).previewRequired).toBe(true)
    expect(classifyChangedPaths(['scripts/catalogue-direct/build-public-sitemap.mjs']).publicChanged).toBe(true)
    expect(classifyChangedPaths(['src/components/home/Hero.test.tsx']).previewRequired).toBe(false)
  })

  it('requests extra database/auth/commerce checks only when impacted', () => {
    expect(classifyChangedPaths(['docs/PROJECT.md'])).toMatchObject({
      previewRequired: false, integrationRequired: false,
      b11Required: false, ciRequired: false,
    })
    expect(classifyChangedPaths(['src/components/home/Hero.tsx'])).toMatchObject({
      previewRequired: true, integrationRequired: false,
      b11Required: false,
    })
    expect(classifyChangedPaths(['supabase/migrations/0001.sql'])).toMatchObject({
      previewRequired: false, integrationRequired: true, ciRequired: true,
    })
    expect(classifyChangedPaths(['src/app/api/orders/route.ts']).integrationRequired).toBe(true)
    expect(classifyChangedPaths(['apps/admin/src/supabase/proxy.ts']).integrationRequired).toBe(true)
    expect(classifyChangedPaths(['scripts/backup/b11_rewrap_core.py'])).toMatchObject({
      integrationRequired: true, b11Required: true, ciRequired: true,
    })
    expect(classifyChangedPaths(['.github/workflows/migration-preview.yml'])).toMatchObject({
      previewRequired: true, integrationRequired: true, b11Required: true,
    })
  })

  it('does not classify database, import, documentation, or test-only changes as app artifacts', () => {
    const result = classifyChangedPaths([
      'db/postgres-migrations/0002_leo561/migration.sql',
      'scripts/migration/leo562-import.ts',
      'docs/deploy/leo-562-deterministic-v1-import.md',
      'apps/public/src/routes.test.ts',
      'apps/admin/src/__tests__/auth.test.ts',
    ])

    expect(result.previewRequired).toBe(false)
    expect(result.publicChanged).toBe(false)
    expect(result.adminChanged).toBe(false)
  })

  it('classifies Public, Admin, shared contract, and shared build changes', () => {
    expect(isMaterialApplicationPath('apps/public/app/page.tsx')).toBe(true)
    expect(isMaterialApplicationPath('apps/admin/next.config.ts')).toBe(true)
    expect(isMaterialApplicationPath('packages/app-contracts/src/index.ts')).toBe(true)
    expect(isMaterialApplicationPath('package-lock.json')).toBe(true)
    expect(isMaterialApplicationPath('apps/public/package-lock.json')).toBe(true)
    expect(isMaterialApplicationPath('scripts/app-foundation/runtime-proof.mts')).toBe(true)
    expect(isMaterialApplicationPath('.github/workflows/migration-preview.yml')).toBe(true)
    expect(isMaterialApplicationPath('apps/public/README.md')).toBe(false)

    expect(classifyChangedPaths(['apps/public/app/page.tsx'])).toMatchObject({
      publicChanged: true,
      adminChanged: false,
      previewRequired: true,
    })
    expect(classifyChangedPaths(['apps/admin/app/page.tsx'])).toMatchObject({
      publicChanged: false,
      adminChanged: true,
      previewRequired: true,
    })
    expect(classifyChangedPaths(['packages/app-contracts/src/index.ts'])).toMatchObject({
      publicChanged: true,
      adminChanged: true,
      previewRequired: true,
    })
  })
})
