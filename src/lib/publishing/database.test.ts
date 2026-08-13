import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { publishingDatabaseUrl } from './database'

const processEnv = process.env as Record<string, string | undefined>
const originalNodeEnv = processEnv.NODE_ENV
const originalPublishingUrl = processEnv.PUBLISHING_DATABASE_URL
const originalDatabaseUrl = processEnv.DATABASE_URL

afterEach(() => {
    processEnv.NODE_ENV = originalNodeEnv
    if (originalPublishingUrl === undefined) delete processEnv.PUBLISHING_DATABASE_URL
    else processEnv.PUBLISHING_DATABASE_URL = originalPublishingUrl
    if (originalDatabaseUrl === undefined) delete processEnv.DATABASE_URL
    else processEnv.DATABASE_URL = originalDatabaseUrl
})

describe('publishing database runtime boundary', () => {
    it('requires its dedicated connection outside tests and never falls back to the CMS connection', () => {
        processEnv.NODE_ENV = 'production'
        delete processEnv.PUBLISHING_DATABASE_URL
        processEnv.DATABASE_URL = 'postgresql://cms-owner:secret@localhost/cms'

        expect(publishingDatabaseUrl).toThrow(
            'PUBLISHING_DATABASE_URL is required for Publishing API runtime access',
        )
    })

    it('uses the dedicated Publishing connection when configured', () => {
        processEnv.NODE_ENV = 'production'
        processEnv.PUBLISHING_DATABASE_URL = 'postgresql://publishing-runtime:secret@localhost/cms'
        processEnv.DATABASE_URL = 'postgresql://cms-owner:secret@localhost/cms'

        expect(publishingDatabaseUrl()).toBe(process.env.PUBLISHING_DATABASE_URL)
    })

    it('keeps every Publishing data-plane module off the CMS owner client', () => {
        const dataPlaneModules: Array<[string, string]> = [
            ['src/app/api/publishing/v1/taxonomy/route.ts', '@/lib/publishing/database'],
            ['src/lib/publishing/auth.ts', './database'],
            ['src/lib/publishing/idempotency.ts', './database'],
            ['src/lib/publishing/media-upload.ts', './database'],
            ['src/lib/publishing/posts.ts', './database'],
            ['src/lib/publishing/rate-limit.ts', './database'],
            ['src/lib/publishing/scheduler.ts', './database'],
        ]

        for (const [modulePath, expectedImport] of dataPlaneModules) {
            const source = readFileSync(resolve(process.cwd(), modulePath), 'utf8')
            expect(source).toContain(`from '${expectedImport}'`)
            expect(source).not.toContain("from '@/lib/prisma'")
        }
    })
})
