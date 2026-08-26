import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const stagingContract = readFileSync(
    resolve(process.cwd(), '.github/workflows/staging-ghcr.yml'),
    'utf8',
)
const productionCandidate = readFileSync(
    resolve(process.cwd(), '.github/workflows/production-candidate.yml'),
    'utf8',
)
const stagingRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/staging-coolify.md'),
    'utf8',
)
const isolatedRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/isolated-staging-foundation.md'),
    'utf8',
)
const productionContract = readFileSync(
    resolve(process.cwd(), 'docs/deploy/postgresql-production-adoption-contract.md'),
    'utf8',
)
const adr = readFileSync(
    resolve(process.cwd(), 'docs/adr/0013-isolated-postgresql-staging-deployment-foundation.md'),
    'utf8',
)
const docsIndex = readFileSync(resolve(process.cwd(), 'docs/README.md'), 'utf8')
const disposableBootstrapRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/staging-db-bootstrap/RUNBOOK.md'),
    'utf8',
)
const publishingRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/publishing-api-v1-runbook.md'),
    'utf8',
)

describe('isolated PostgreSQL Staging deployment foundation', () => {
    it('requires protected main and an immutable candidate digest', () => {
        expect(stagingContract).toContain('name: Deploy candidate to isolated Staging')
        expect(stagingContract).toContain('test "$GITHUB_REF" = "refs/heads/main"')
        expect(stagingContract).toContain('candidate_digest:')
        expect(stagingContract).toContain('packages: read')
        expect(stagingContract).toContain('docker pull "$image_ref"')
        expect(stagingContract).toContain('source_revision')
        expect(stagingContract).toContain('test "$source_revision" = "$GITHUB_SHA"')
        expect(stagingContract).toContain('npm run staging:isolated -- proof')
        expect(stagingContract).not.toContain('production database')
    })

    it('keeps the protected-main Production Candidate as the only staging artifact', () => {
        expect(productionCandidate).toContain(
            'test "$GITHUB_REF" = "refs/heads/main"',
        )
        expect(productionCandidate).toContain(
            'production-candidate-${{ github.sha }}',
        )
        expect(productionCandidate).toContain('DEPLOY_TARGET=production')
        expect(productionCandidate).toContain(
            'PUBLISHING_BUNNY_CDN_HOSTNAME=${{ vars.PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME }}',
        )
    })

    it('documents one replay/deploy/smoke/verify path and rebuild rollback', () => {
        expect(isolatedRunbook).toContain('code → PostgreSQL migration → isolated Staging')
        expect(isolatedRunbook).toContain('dpg-isolated-staging-backend')
        expect(isolatedRunbook).toContain('dpg_staging_migrator')
        expect(isolatedRunbook).toContain('npm run staging:isolated -- proof')
        expect(isolatedRunbook).toContain('npm run staging:isolated -- reset')
        expect(isolatedRunbook).toContain('fails closed')
        expect(isolatedRunbook).toContain('0001_pipeline_probe.sql')
    })

    it('keeps Production adoption HIGH_RISK contract-only', () => {
        expect(productionContract).toContain('NOT AUTHORIZED / contract only')
        expect(productionContract).toContain('select-only Production schema comparison')
        expect(productionContract).toContain('migration execution owner')
        expect(productionContract).toMatch(/same\s+immutable Staging-validated image digest/)
        expect(productionContract).toContain('No Production mutation')
    })

    it('fences the legacy shared-data runtime and disposable fixtures', () => {
        expect(stagingRunbook).toContain('LEGACY REFERENCE ONLY')
        expect(stagingRunbook).toContain('Do not replay `db/postgres-migrations`')
        expect(docsIndex).toContain('CI-only disposable database fixtures')
        expect(docsIndex).toContain('Isolated PostgreSQL Staging deployment foundation')
        expect(docsIndex).toContain('FAST_PATH/STANDARD/HIGH_RISK')
        expect(disposableBootstrapRunbook).toContain('not a Staging runtime runbook')
        expect(disposableBootstrapRunbook).toMatch(
            /must not be executed against Staging or\s+Production/,
        )
        expect(publishingRunbook).toContain('superseded historical')
        expect(publishingRunbook).toContain('must remain write-frozen')
        expect(publishingRunbook).not.toContain('either artifact on shared-data Staging unless')
    })

    it('records ADR 0013 as the superseding deployment decision', () => {
        expect(adr).toContain('Status')
        expect(adr).toContain('Accepted; canonical for database migration and candidate deployment')
        expect(adr).toContain('code → PostgreSQL migration → isolated Staging')
        expect(adr).toContain('Production is not mutated by this ADR')
    })
})
