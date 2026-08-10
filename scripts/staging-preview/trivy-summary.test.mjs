import { describe, expect, it } from 'vitest'
import {
    assertTrivyZero,
    sanitizeTrivyReport,
} from './lib.mjs'

const candidateSha = 'a'.repeat(40)
const candidateDigest = `sha256:${'b'.repeat(64)}`

function reportFixture() {
    return {
        ArtifactName: 'ghcr.io/example/app@sha256:should-not-be-copied',
        Metadata: {
            ImageConfig: { Env: ['DATABASE_URL=postgresql://secret'] },
        },
        Results: [
            {
                Target: 'alpine:3.22',
                Class: 'os-pkgs',
                Type: 'alpine',
                Vulnerabilities: [{
                    VulnerabilityID: 'CVE-2026-0002',
                    PkgName: 'zlib',
                    InstalledVersion: '1.3.1-r1',
                    FixedVersion: '1.3.1-r2',
                    Severity: 'CRITICAL',
                    Title: 'https://secret.example/title',
                    PrimaryURL: 'https://secret.example/advisory',
                }],
            },
            {
                Target: 'node_modules/nanoid',
                Class: 'lang-pkgs',
                Type: 'npm',
                Vulnerabilities: [{
                    VulnerabilityID: 'GHSA-28wg-ghj8-5hjv',
                    PkgName: 'nanoid',
                    InstalledVersion: '5.1.9',
                    FixedVersion: '5.1.16',
                    Severity: 'HIGH',
                    DataSource: { URL: 'https://secret.example/source' },
                }],
            },
        ],
    }
}

describe('sanitized Trivy evidence', () => {
    it('keeps deterministic aggregate and fixed-version evidence only', () => {
        const summary = sanitizeTrivyReport(reportFixture(), { candidateSha, candidateDigest })

        expect(summary).toEqual({
            schemaVersion: 1,
            candidateSha,
            candidateDigest,
            scanStatus: 'complete',
            errorCode: null,
            counts: { high: 1, critical: 1 },
            redactedFieldCounts: {},
            findings: [
                {
                    severity: 'CRITICAL',
                    component: 'os',
                    advisory: 'CVE-2026-0002',
                    package: 'zlib',
                    installedVersion: '1.3.1-r1',
                    fixedVersion: '1.3.1-r2',
                },
                {
                    severity: 'HIGH',
                    component: 'app',
                    advisory: 'GHSA-28wg-ghj8-5hjv',
                    package: 'nanoid',
                    installedVersion: '5.1.9',
                    fixedVersion: '5.1.16',
                },
            ],
        })
    })

    it('does not copy raw metadata, URLs, titles, or environment fields', () => {
        const summaryText = JSON.stringify(sanitizeTrivyReport(reportFixture(), { candidateSha, candidateDigest }))

        expect(summaryText).not.toContain('should-not-be-copied')
        expect(summaryText).not.toContain('DATABASE_URL')
        expect(summaryText).not.toContain('postgresql://')
        expect(summaryText).not.toContain('https://')
        expect(summaryText).not.toContain('secret.example')
        expect(summaryText).not.toContain('ArtifactName')
        expect(summaryText).not.toContain('Metadata')
        expect(summaryText).not.toContain('PrimaryURL')
    })

    it('writes a safe unavailable summary when the raw report is missing', () => {
        const summary = sanitizeTrivyReport(null, { candidateSha, candidateDigest })

        expect(summary).toMatchObject({
            scanStatus: 'unavailable',
            errorCode: 'trivy-report-unavailable',
            counts: { high: null, critical: null },
            findings: [],
        })
        expect(() => assertTrivyZero(summary)).toThrow('unavailable')
    })

    it('fails closed on a malformed Trivy report shape', () => {
        const summary = sanitizeTrivyReport({ Results: [{ Vulnerabilities: 'not-an-array' }] }, { candidateSha, candidateDigest })

        expect(summary).toMatchObject({
            scanStatus: 'invalid',
            errorCode: 'unsafe-finding-shape',
            counts: { high: null, critical: null },
            findings: [],
        })
        expect(() => assertTrivyZero(summary)).toThrow('unavailable or invalid')
    })

    it('keeps an explicit null fixed version without exposing raw fields', () => {
        const summary = sanitizeTrivyReport({
            Results: [{
                Class: 'os-pkgs',
                Vulnerabilities: [{
                    VulnerabilityID: 'CVE-2026-0003',
                    PkgName: 'openssl',
                    InstalledVersion: '3.0.0-r0',
                    FixedVersion: '',
                    Severity: 'HIGH',
                }],
            }],
        }, { candidateSha, candidateDigest })

        expect(summary.findings[0].fixedVersion).toBeNull()
        expect(summary.counts).toEqual({ high: 1, critical: 0 })
    })

    it('redacts forbidden URL or secret-shaped finding fields without losing counts', () => {
        const summary = sanitizeTrivyReport({
            Results: [{
                Class: 'lang-pkgs',
                Vulnerabilities: [{
                    VulnerabilityID: 'GHSA-safe-test',
                    PkgName: 'https://secret.example/package',
                    InstalledVersion: 'API_TOKEN=do-not-copy',
                    FixedVersion: '1.0.1',
                    Severity: 'HIGH',
                }],
            }],
        }, { candidateSha, candidateDigest })

        expect(summary).toMatchObject({
            scanStatus: 'complete',
            errorCode: null,
            counts: { high: 1, critical: 0 },
            redactedFieldCounts: { installedVersion: 1, package: 1 },
            findings: [{
                severity: 'HIGH',
                advisory: 'GHSA-safe-test',
                package: null,
                installedVersion: null,
                fixedVersion: '1.0.1',
                redactedFields: ['package', 'installedVersion'],
            }],
        })
        expect(JSON.stringify(summary)).not.toContain('postgresql://')
        expect(JSON.stringify(summary)).not.toContain('DATABASE_URL')
        expect(JSON.stringify(summary)).not.toContain('https://secret.example/package')
        expect(JSON.stringify(summary)).not.toContain('API_TOKEN=do-not-copy')
        expect(() => assertTrivyZero(summary)).toThrow('gate failed')
    })

    it('redacts non-allowlisted finding strings while retaining safe remediation fields', () => {
        const summary = sanitizeTrivyReport({
            Results: [{
                Class: 'os-pkgs',
                Vulnerabilities: [{
                    VulnerabilityID: 'CVE-2026-0042',
                    PkgName: 'package name with spaces',
                    InstalledVersion: '1.2.3-r1',
                    FixedVersion: '1.2.3-r2',
                    Severity: 'CRITICAL',
                }],
            }],
        }, { candidateSha, candidateDigest })

        expect(summary.counts).toEqual({ high: 0, critical: 1 })
        expect(summary.redactedFieldCounts).toEqual({ package: 1 })
        expect(summary.findings[0]).toMatchObject({
            advisory: 'CVE-2026-0042',
            package: null,
            installedVersion: '1.2.3-r1',
            fixedVersion: '1.2.3-r2',
            redactedFields: ['package'],
        })
        expect(JSON.stringify(summary)).not.toContain('package name with spaces')
        expect(() => assertTrivyZero(summary)).toThrow('gate failed')
    })

    it('fails closed on nonzero counts and passes only an exact zero summary', () => {
        const passing = sanitizeTrivyReport({ Results: [] }, { candidateSha, candidateDigest })
        expect(assertTrivyZero(passing)).toBe(true)

        const failing = sanitizeTrivyReport(reportFixture(), { candidateSha, candidateDigest })
        expect(() => assertTrivyZero(failing)).toThrow('gate failed')
    })

    it('keeps rollback evidence distinguishable while preserving sanitized fields on failure', () => {
        const summary = sanitizeTrivyReport(reportFixture(), {
            candidateSha,
            candidateDigest,
            imageRole: 'exact-main-rollback',
        })
        expect(summary.imageRole).toBe('exact-main-rollback')
        expect(summary.counts).toEqual({ high: 1, critical: 1 })
        const serialized = JSON.stringify(summary)
        expect(serialized).not.toContain('DATABASE_URL')
        expect(serialized).not.toContain('https://')
        expect(() => assertTrivyZero(summary)).toThrow('gate failed')
    })
})
