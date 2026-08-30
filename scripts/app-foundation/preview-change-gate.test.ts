import { describe, expect, it } from 'vitest'

import {
  classifyChangedPaths,
  isMaterialApplicationPath,
} from './preview-change-gate.mjs'

describe('LEO-563 repository-code Preview gate', () => {
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
