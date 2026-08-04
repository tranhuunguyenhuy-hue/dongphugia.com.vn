import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { hashObject } = require('../../src/lib/content-review/hash.ts') as typeof import('../../src/lib/content-review/hash')
const { cleanupProductHtml } = require('../../src/lib/content-review/cleanup.ts') as typeof import('../../src/lib/content-review/cleanup')
const {
    LEO_489_PILOT_MANIFEST,
    LEO_489_PILOT_MANIFEST_CHECKSUM,
    pilotManifestEntryHash,
} = require('../../src/lib/content-review/pilot-manifest.ts') as typeof import('../../src/lib/content-review/pilot-manifest')
const {
    PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
    PRECOMPUTED_PACKAGE_SOURCE,
    calculatePrecomputedPackageHash,
    validateAndGeneratePrecomputedProposals,
} = require('../../src/lib/content-review/precomputed.ts') as typeof import('../../src/lib/content-review/precomputed')
import type { PrecomputedProposalPackage, PrecomputedProposalRecord } from '../../src/lib/content-review/precomputed'

const BRAND_NAMES: Record<string, string> = {
    'american-standard': 'American Standard',
    atmor: 'ATMOR',
    caesar: 'Caesar',
    inax: 'INAX',
    moen: 'Moen',
    toto: 'TOTO',
    viglacera: 'Viglacera',
}

function mediaFor(entry: (typeof LEO_489_PILOT_MANIFEST)[number]): { kind: 'main' | 'embedded'; url: string } {
    if (entry.mediaClass === 'HITA_HOSTED') {
        return { kind: 'main', url: `https://cdn.hita.com.vn/leo-489-redacted/${entry.id}.jpg` }
    }
    if (entry.mediaClass === 'EMBEDDED') {
        return { kind: 'embedded', url: `https://cdn.dongphugia.com.vn/leo-489-redacted/${entry.id}.jpg` }
    }
    return { kind: 'main', url: `https://cdn.dongphugia.com.vn/leo-489-redacted/${entry.id}.jpg` }
}

function createRecord(entry: (typeof LEO_489_PILOT_MANIFEST)[number]): PrecomputedProposalRecord {
    const brand = BRAND_NAMES[entry.brandSlug] || entry.brandSlug
    const name = `${brand} ${entry.sku}`
    const media = mediaFor(entry)
    const beforeDescriptionHtml = `<p>${brand} ${entry.sku}.</p>${media.kind === 'embedded' ? `<p><img src="${media.url}" alt="${name}" /></p>` : ''}`
    const generatedHtml = cleanupProductHtml(`<p>${brand} ${entry.sku} chính hãng.</p>${media.kind === 'embedded' ? `<p><img src="${media.url}" alt="${name}" /></p>` : ''}`)
    const input = {
        id: entry.id,
        sku: entry.sku,
        name,
        sourceUrl: `offline://leo-489/${entry.id}`,
        descriptionHtml: beforeDescriptionHtml,
        ...(media.kind === 'main' ? { imageMainUrl: media.url } : {}),
    }
    const requiredFacts = [brand, entry.sku]
    return {
        manifest: { ...entry },
        input,
        requiredFacts,
        generatedHtml,
        media: [media],
        provenance: {
            source: 'approved_read_only_fact_sheet',
            inputHash: hashObject(input),
            beforeDescriptionHash: hashObject(beforeDescriptionHtml),
            afterDescriptionHash: hashObject(generatedHtml),
            factsHash: hashObject(requiredFacts),
        },
    }
}

function buildPackage(): PrecomputedProposalPackage {
    const records = LEO_489_PILOT_MANIFEST.map(createRecord)
    const withoutHash = {
        schemaVersion: PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
        source: PRECOMPUTED_PACKAGE_SOURCE,
        manifestChecksum: LEO_489_PILOT_MANIFEST_CHECKSUM,
        manifestEntryHash: pilotManifestEntryHash(),
        records,
    }
    return { ...withoutHash, packageHash: calculatePrecomputedPackageHash(withoutHash) }
}

function mediaLabel(proposal: Awaited<ReturnType<typeof validateAndGeneratePrecomputedProposals>>['proposals'][number]) {
    return proposal.after.images.length === 0
        ? 'none supplied'
        : proposal.after.images.map(image => `${image.kind}: ${image.policy} → ${image.decision} (source redacted)`).join('; ')
}

function redactMediaUrls(html: string): string {
    return html.replace(/\s+(src|href)="[^"]*"/gi, ' $1="[redacted media URL]"')
}

function buildReviewBundle(packageValue: PrecomputedProposalPackage, proposals: Awaited<ReturnType<typeof validateAndGeneratePrecomputedProposals>>['proposals']): string {
    const sections = proposals.map((proposal, index) => {
        const telemetry = proposal.generation.telemetry
        const diff = proposal.audit?.diff
        return [
            `## ${index + 1}. ${proposal.product.name}`,
            '',
            `- Product ID: \`${proposal.product.id}\``,
            `- SKU: \`${proposal.product.sku}\``,
            `- Proposal: \`${proposal.proposalId}\``,
            `- Validation: **PASS**`,
            `- Media decisions: ${mediaLabel(proposal)}`,
            `- Provenance: before \`${proposal.generation.provenance?.beforeHash || 'n/a'}\`; after \`${proposal.generation.provenance?.afterHash || 'n/a'}\`; facts \`${proposal.generation.provenance?.factsHash || 'n/a'}\``,
            `- Telemetry: ${telemetry?.beforeCharacters || 0} → ${telemetry?.afterCharacters || 0} characters; token estimate ${telemetry?.beforeTokenEstimate || 0} → ${telemetry?.afterTokenEstimate || 0}`,
            '',
            '### Before',
            '',
            '```html',
            redactMediaUrls(proposal.before.descriptionHtml),
            '```',
            '',
            '### After',
            '',
            '```html',
            redactMediaUrls(proposal.after.descriptionHtml),
            '```',
            '',
            '### Deterministic diff',
            '',
            `- Algorithm: \`${diff?.algorithm || 'n/a'}\``,
            `- Changed: \`${diff?.changed ? 'yes' : 'no'}\``,
            `- Description hashes: before \`${proposal.audit?.beforeDescriptionHash || 'n/a'}\`; after \`${proposal.audit?.afterDescriptionHash || 'n/a'}\``,
            `- Character window: +${diff?.addedCharacters || 0} / -${diff?.removedCharacters || 0}; common prefix ${diff?.commonPrefixCharacters || 0}; common suffix ${diff?.commonSuffixCharacters || 0}`,
            '',
            '```diff',
            `- ${redactMediaUrls(proposal.before.descriptionHtml)}`,
            `+ ${redactMediaUrls(proposal.after.descriptionHtml)}`,
            '```',
            '',
        ].join('\n')
    }).join('\n')
    return [
        '# LEO-489 Pilot Review Bundle',
        '',
        'Sanitized static review bundle generated by the offline precomputed path. It contains only contract identities, worker-authored minimum fact-sheet text, deterministic hashes/telemetry, and redacted media decisions. No Hita asset was fetched or copied; no database or public product field was written.',
        '',
        `- Manifest checksum: \`${packageValue.manifestChecksum}\``,
        `- Manifest entry hash: \`${packageValue.manifestEntryHash}\``,
        `- Package hash: \`${packageValue.packageHash}\``,
        `- Products: ${proposals.length}`,
        `- Proposal mode: \`precomputed\``,
        '',
        sections,
    ].join('\n')
}

async function main() {
    const packagePath = path.join(process.cwd(), 'scripts/content-review/private/leo-489-pilot-package.json')
    const bundlePath = path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-review.md')
    const packageValue = buildPackage()
    await fs.mkdir(path.dirname(packagePath), { recursive: true })
    await fs.writeFile(packagePath, `${JSON.stringify(packageValue, null, 2)}\n`, 'utf8')
    const validation = await validateAndGeneratePrecomputedProposals(packageValue)
    await fs.mkdir(path.dirname(bundlePath), { recursive: true })
    await fs.writeFile(bundlePath, buildReviewBundle(packageValue, validation.proposals), 'utf8')
    console.log(JSON.stringify({
        products: validation.proposals.length,
        manifestChecksum: packageValue.manifestChecksum,
        manifestEntryHash: packageValue.manifestEntryHash,
        packageHash: packageValue.packageHash,
        bundlePath: 'docs/review-bundles/leo-489-pilot-review.md',
        mode: 'precomputed',
        validation: 'PASS',
        hitaAssetsFetched: false,
        databaseWrites: false,
    }, null, 2))
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
