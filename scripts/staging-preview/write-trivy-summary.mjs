#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { sanitizeTrivyReport, stableJson } from './lib.mjs'

const inputPath = process.env.TRIVY_RESULT_PATH ?? '/tmp/trivy-results.json'
const outputPath = process.env.TRIVY_SUMMARY_PATH ?? 'artifacts/staging-preview/trivy-summary.json'
let report = null

try {
    report = JSON.parse(await readFile(inputPath, 'utf8'))
} catch {
    report = null
}

const summary = sanitizeTrivyReport(report, {
    candidateSha: process.env.CANDIDATE_SHA,
    candidateDigest: process.env.CANDIDATE_DIGEST,
})

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, stableJson(summary), { mode: 0o600 })
console.log(`Sanitized Trivy summary written: ${summary.scanStatus}.`)
