#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

const sourceHosts = new Set([
    'dongphugia.com.vn',
    'www.dongphugia.com.vn',
])
const targetHost = 'www.dongphugia.vn'
const timeoutMs = Math.max(1000, Number(process.env.TIMEOUT_MS || 10000))
const maxHops = Math.max(1, Number(process.env.MAX_REDIRECT_HOPS || 3))
const inputPath = process.argv[2] || process.env.URLS_FILE

if (!inputPath) {
    console.error(JSON.stringify({ ok: false, error: 'URLS_FILE_REQUIRED' }))
    process.exit(1)
}

const lines = (await readFile(inputPath, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

const errorCounts = new Map()
const addError = (code) => errorCounts.set(code, (errorCounts.get(code) || 0) + 1)

async function request(url) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: { accept: 'text/html' },
        })
        await response.body?.cancel()
        return {
            status: response.status,
            location: response.headers.get('location'),
        }
    } catch (error) {
        return {
            error: error?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED',
        }
    } finally {
        clearTimeout(timeout)
    }
}

async function verifyUrl(line) {
    let original
    try {
        original = new URL(line)
    } catch {
        return 'INVALID_URL'
    }

    if (original.protocol !== 'https:' || !sourceHosts.has(original.hostname)) {
        return 'SOURCE_HOST_REQUIRED'
    }

    const expectedPath = original.pathname
    const expectedSearch = original.search
    let current = original

    for (let hop = 0; hop <= maxHops; hop += 1) {
        const result = await request(current)
        if (result.error) return result.error

        if (current.hostname === targetHost) {
            return result.status === 200 ? null : `TARGET_STATUS_${result.status}`
        }

        if (current.hostname === 'cdn.dongphugia.com.vn') {
            return 'CDN_REDIRECT_FORBIDDEN'
        }

        if (result.status !== 308 || !result.location) {
            return `SOURCE_STATUS_${result.status}`
        }

        let next
        try {
            next = new URL(result.location, current)
        } catch {
            return 'INVALID_LOCATION'
        }

        if (next.protocol !== 'https:' || next.hostname !== targetHost) {
            return 'WRONG_TARGET_HOST'
        }

        if (next.pathname !== expectedPath || next.search !== expectedSearch) {
            return 'PATH_QUERY_NOT_PRESERVED'
        }

        current = next
    }

    return 'REDIRECT_HOP_LIMIT'
}

let passed = 0
for (const line of lines) {
    const error = await verifyUrl(line)
    if (error) addError(error)
    else passed += 1
}

const errors = Object.fromEntries([...errorCounts.entries()].sort())
const ok = lines.length > 0 && passed === lines.length
console.log(JSON.stringify({
    ok,
    total: lines.length,
    passed,
    failed: lines.length - passed,
    errors,
}))

process.exitCode = ok ? 0 : 1
