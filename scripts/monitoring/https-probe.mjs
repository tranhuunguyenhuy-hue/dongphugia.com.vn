#!/usr/bin/env node

import { performance } from 'node:perf_hooks'

const DEFAULT_CHECKS = [
    { path: '/api/health', expectedStatus: 200 },
    { path: '/', expectedStatus: 200 },
    { path: '/gach-op-lat', expectedStatus: 200 },
    { path: '/tim-kiem?q=voi', expectedStatus: 200 },
]

const baseUrlText = process.env.BASE_URL || 'https://www.dongphugia.vn'
const timeoutMs = Math.max(1000, Number(process.env.TIMEOUT_MS || 10000))

function fail(message) {
    console.error(JSON.stringify({ ok: false, error: message }))
    process.exitCode = 1
}

let baseUrl
try {
    baseUrl = new URL(baseUrlText)
} catch {
    fail('INVALID_BASE_URL')
}

if (!baseUrl) {
    process.exit()
}

if (baseUrl.protocol !== 'https:') {
    fail('HTTPS_REQUIRED')
}

const allowedHosts = new Set([
    'www.dongphugia.vn',
    'dongphugia.vn',
])

if (!allowedHosts.has(baseUrl.hostname)) {
    fail('UNAPPROVED_PROBE_HOST')
}

let checks = DEFAULT_CHECKS
if (process.env.ROUTE_CHECKS) {
    try {
        checks = JSON.parse(process.env.ROUTE_CHECKS)
    } catch {
        fail('INVALID_ROUTE_CHECKS')
    }
}

if (!Array.isArray(checks) || checks.length === 0 || checks.length > 20) {
    fail('ROUTE_CHECKS_BOUNDS')
}

if (process.exitCode) {
    process.exit()
}

const results = []

for (const [index, check] of checks.entries()) {
    if (!check || typeof check.path !== 'string' || !Number.isInteger(check.expectedStatus)) {
        results.push({ index, passed: false, error: 'INVALID_CHECK' })
        continue
    }

    const target = new URL(check.path, baseUrl)
    if (target.origin !== baseUrl.origin) {
        results.push({ index, passed: false, error: 'CROSS_ORIGIN_ROUTE' })
        continue
    }

    const started = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(target, {
            redirect: 'manual',
            signal: controller.signal,
            headers: { accept: 'text/html,application/json' },
        })
        const location = response.headers.get('location')
        let locationHost
        if (location) {
            try {
                locationHost = new URL(location, target).hostname
            } catch {
                locationHost = 'INVALID'
            }
        }

        results.push({
            index,
            status: response.status,
            expectedStatus: check.expectedStatus,
            latencyMs: Math.round(performance.now() - started),
            locationHost,
            passed: response.status === check.expectedStatus,
        })
    } catch (error) {
        results.push({
            index,
            latencyMs: Math.round(performance.now() - started),
            passed: false,
            error: error?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED',
        })
    } finally {
        clearTimeout(timeout)
    }
}

const ok = results.every((result) => result.passed)
console.log(JSON.stringify({
    ok,
    host: baseUrl.hostname,
    checks: results,
}))

process.exitCode = ok ? 0 : 1
