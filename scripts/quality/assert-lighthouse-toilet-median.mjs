import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const OUTPUT_DIR = path.resolve('.lighthouseci')
const REQUIRED_RUNS = 3
const THRESHOLDS = {
    lcp: 4_000,
    payload: 3 * 1024 * 1024,
    cls: 0.1,
    performance: 85,
}

async function listJsonFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) return listJsonFiles(entryPath)
        return entry.name.endsWith('.json') ? [entryPath] : []
    }))
    return nested.flat()
}

function median(values) {
    const ordered = [...values].sort((left, right) => left - right)
    return ordered[Math.floor(ordered.length / 2)]
}

function metric(lhr, key) {
    const value = lhr.audits?.[key]?.numericValue
    if (!Number.isFinite(value)) throw new Error(`Missing numeric Lighthouse audit: ${key}`)
    return value
}

const reports = []
for (const file of await listJsonFiles(OUTPUT_DIR)) {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (parsed?.audits && parsed?.categories?.performance) reports.push(parsed)
}

if (reports.length !== REQUIRED_RUNS) {
    throw new Error(
        `Expected exactly ${REQUIRED_RUNS} Lighthouse reports for the synthetic toilet listing; found ${reports.length}.`,
    )
}

const results = {
    lcp: median(reports.map((report) => metric(report, 'largest-contentful-paint'))),
    payload: median(reports.map((report) => metric(report, 'total-byte-weight'))),
    cls: median(reports.map((report) => metric(report, 'cumulative-layout-shift'))),
    performance: median(reports.map((report) => report.categories.performance.score * 100)),
}

console.log('Synthetic mobile toilet-listing median', JSON.stringify(results))

const failures = [
    results.lcp <= THRESHOLDS.lcp || `LCP ${results.lcp}ms exceeds ${THRESHOLDS.lcp}ms`,
    results.payload <= THRESHOLDS.payload || `payload ${results.payload} bytes exceeds ${THRESHOLDS.payload} bytes`,
    results.cls <= THRESHOLDS.cls || `CLS ${results.cls} exceeds ${THRESHOLDS.cls}`,
    results.performance >= THRESHOLDS.performance || `performance ${results.performance} is below ${THRESHOLDS.performance}`,
].filter((result) => result !== true)

if (failures.length > 0) {
    throw new Error(`Synthetic toilet listing performance gate failed: ${failures.join('; ')}`)
}
