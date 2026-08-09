#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { STAGING_URL, assertSha, assertStagingUrl, stableJson } from './lib.mjs'

const baseUrl = assertStagingUrl(process.env.STAGING_SITE_URL ?? STAGING_URL)
const expectedSha = assertSha(process.env.CANDIDATE_SHA, 'Candidate SHA')
const outputPath = process.env.ROUTE_REPORT_PATH ?? 'artifacts/staging-preview/route-report.json'

const routes = [
    { path: '/', status: 200, marker: 'STG-DEMO' },
    { path: '/api/health', status: 200 },
    { path: '/api/revision', status: 200 },
    { path: '/api/staging-identity', status: 200 },
    { path: '/thiet-bi-ve-sinh', status: 200, marker: 'STG-DEMO' },
    { path: '/thiet-bi-ve-sinh/stg-demo-bon-cau/stg-demo-bon-cau-smoke-test', status: 200, marker: 'STG-DEMO' },
    { path: '/tim-kiem?q=STG-DEMO', status: 200, marker: 'STG-DEMO' },
    { path: '/robots.txt', status: 200 },
    { path: '/sitemap.xml', status: 200 },
    { path: '/admin/login', status: 200 },
    { path: '/admin', status: 307, location: '/admin/login' },
]

const forbidden = [
    'https://www.dongphugia.vn',
    'https://dongphugia.vn',
    'vercel.app',
    'supabase.co',
]

const report = []
for (const route of routes) {
    const response = await fetch(`${baseUrl}${route.path}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
    })
    const body = await response.text()
    const location = response.headers.get('location')
    const result = {
        path: route.path,
        expectedStatus: route.status,
        actualStatus: response.status,
        markerPresent: route.marker ? body.includes(route.marker) : null,
        forbiddenIndicatorPresent: forbidden.some((indicator) => body.toLowerCase().includes(indicator.toLowerCase())),
        locationAccepted: route.location ? location?.startsWith(route.location) === true : null,
    }
    if (
        result.actualStatus !== result.expectedStatus
        || result.markerPresent === false
        || result.forbiddenIndicatorPresent
        || result.locationAccepted === false
    ) {
        throw new Error(`Mandatory staging route failed: ${route.path}.`)
    }
    report.push(result)
}

const revision = JSON.parse(await (await fetch(`${baseUrl}/api/revision`)).text())
if (revision.sourceRevision !== expectedSha || revision.stagingPreview !== true) {
    throw new Error('Route report runtime revision did not match the candidate SHA.')
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, stableJson({ schemaVersion: 1, baseUrl, expectedSha, routes: report }), { mode: 0o600 })
console.log(`Staging route report accepted ${report.length} routes for ${expectedSha}.`)
