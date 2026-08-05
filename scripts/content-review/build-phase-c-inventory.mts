import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { hashObject } = require('../../src/lib/content-review/hash') as typeof import('../../src/lib/content-review/hash')
const { POLICY_HASH, POLICY_CONTRACT } = require('../../src/lib/content-review/policy-contract') as typeof import('../../src/lib/content-review/policy-contract')
const { assertPhaseCInventoryBinding, classifyInventory } = require('../../src/lib/content-review/phase-c-inventory') as typeof import('../../src/lib/content-review/phase-c-inventory')

const root = process.cwd()
const inputPath = path.join(root, 'scripts/content-review/private/leo-493-phase-c-active-snapshot.json')
const publicManifestPath = path.join(root, 'docs/review-bundles/leo-493-phase-c-inventory-manifest.json')
const publicReportPath = path.join(root, 'docs/review-bundles/leo-493-phase-c-inventory-report.md')
const privateOutputPath = path.join(root, 'scripts/content-review/private/leo-493-phase-c-inventory.json')

type Snapshot = { policyHash: string; snapshotHash: string; counts: { activeProducts: number; productImageRows: number }; blockers: unknown; products: Parameters<typeof classifyInventory>[0] }

function sortedCounts(values: string[]): Record<string, number> {
    return Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map<string, number>())].sort(([left], [right]) => left.localeCompare(right)))
}

function nestedCounts(rows: Array<{ classification: { gate: string; family: string; lengthBucket: string; embeddedCount: number; mediaRisk: string }; brand: { slug: string } | null; category: { slug: string } | null }>, key: 'gate' | 'family' | 'lengthBucket' | 'embeddedCount' | 'mediaRisk' | 'brand' | 'category'): Record<string, number> {
    return sortedCounts(rows.map((row) => key === 'brand' ? row.brand?.slug || 'UNKNOWN' : key === 'category' ? row.category?.slug || 'UNKNOWN' : String(row.classification[key])))
}

function markdownTable(title: string, values: Record<string, number>): string {
    return [`### ${title}`, '', '| Giá trị | Số lượng |', '|---|---:|', ...Object.entries(values).map(([key, value]) => `| ${key} | ${value} |`), ''].join('\n')
}

async function main() {
    const snapshot = JSON.parse(await fs.readFile(inputPath, 'utf8')) as Snapshot
    if (snapshot.policyHash !== POLICY_HASH || snapshot.products.length !== snapshot.counts.activeProducts) throw new Error('Snapshot policy/count binding or completeness failed')
    const classified = classifyInventory(snapshot.products)
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const rewriteRows = classified.filter((row) => row.classification.gate === 'REWRITE_IMPORTANT')
    const candidateRows = classified.filter((row) => row.classification.gate === 'CONTENT_REVIEW_CANDIDATE')

    const publicRows = classified.map((row) => ({
        id: row.id,
        sku: row.sku,
        brand: row.brand?.slug || null,
        category: row.category?.slug || null,
        updatedAt: row.updatedAt,
        identityHash: row.classification.identityHash,
        descriptionHash: row.descriptionHash,
        visibleLength: row.visibleLength,
        lengthBucket: row.classification.lengthBucket,
        embeddedCount: row.classification.embeddedCount,
        mediaCount: row.classification.mediaCount,
        mediaRisk: row.classification.mediaRisk,
        gate: row.classification.gate,
        family: row.classification.family,
        reasonCodes: row.classification.reasonCodes,
        blocker: row.classification.blocker,
        mediaFingerprints: row.media.map((media) => media.fingerprint),
    })).sort((left, right) => left.id - right.id)

    const publicCanonical = {
        schemaVersion: 1,
        artifact: 'leo-493-phase-c-inventory',
        contractVersion: POLICY_CONTRACT.version,
        policyHash: POLICY_HASH,
        snapshotHash: snapshot.snapshotHash,
        proposalHash: null,
        sourceCommit,
        bindingStatus: 'INVENTORY_ONLY_NO_PROPOSAL',
        selectionAlgorithm: 'all_active_products_is_active_true_sorted_by_id; no 200-300 cap; no gate relaxation',
        sanitization: 'ids/raw SKUs/labels/classifications/hashes/fingerprints only; no raw HTML or live media URLs',
        counts: {
            activeProducts: classified.length,
            productImageRows: snapshot.counts.productImageRows,
            rewriteImportant: rewriteRows.length,
            contentReviewCandidate: candidateRows.length,
            keepExistingContent: classified.length - rewriteRows.length - candidateRows.length,
        },
        products: publicRows,
    }
    assertPhaseCInventoryBinding({ policyHash: POLICY_HASH, snapshotHash: snapshot.snapshotHash, proposalHash: null, sourceCommit, bindingStatus: 'INVENTORY_ONLY_NO_PROPOSAL' }, { policyHash: POLICY_HASH, snapshotHash: snapshot.snapshotHash, sourceCommit, bindingStatus: 'INVENTORY_ONLY_NO_PROPOSAL' })
    const manifestChecksum = hashObject(publicCanonical)
    const publicManifest = { ...publicCanonical, manifestChecksum }

    const privateRows = classified.map((row) => ({ id: row.id, sku: row.sku, name: row.name, brand: row.brand, category: row.category, updatedAt: row.updatedAt, descriptionHash: row.descriptionHash, visibleLength: row.visibleLength, media: row.media, classification: row.classification })).sort((left, right) => left.id - right.id)
    const privateValue = { ...publicManifest, privateSource: 'sanitized inventory metadata; no raw HTML/live media URL', products: privateRows }
    const reportLines = [
        '# LEO-493 Phase C v3.2 — Active product inventory and gating',
        '',
        `- Source commit at generation: \`${sourceCommit}\``,
        `- Policy hash: \`${POLICY_HASH}\``,
        `- Snapshot hash: \`${snapshot.snapshotHash}\``,
        `- Manifest checksum: \`${manifestChecksum}\``,
        '- Binding: `INVENTORY_ONLY_NO_PROPOSAL` — no scaled prose generated in Phase C inventory turn.',
        '- Scope: every active `products.is_active = true` row from the canonical production runtime, read-only; no production write.',
        '',
        '## Gate result',
        '',
        `- REWRITE_IMPORTANT: **${rewriteRows.length}** — complete approved family, visible Before >=500 characters, and at least one embedded description image.`,
        `- CONTENT_REVIEW_CANDIDATE: **${candidateRows.length}** — one evidence gate, ambiguous identity/family, or identity blocker.`,
        `- KEEP_EXISTING_CONTENT: **${classified.length - rewriteRows.length - candidateRows.length}** — accessories/spares/components, outside approved families, or sparse source.`,
        '',
        `Strict cohort recommendation: keep the gate unchanged. The eligible rewrite cohort is ${rewriteRows.length} of ${classified.length}; do not relax the >=500 + embedded-image rule to reach a target scale. Coordinator acceptance is required before any content generation.`,
        '',
        markdownTable('Gate', nestedCounts(classified, 'gate')),
        markdownTable('Important family', nestedCounts(classified, 'family')),
        markdownTable('Brand', nestedCounts(classified, 'brand')),
        markdownTable('Category', nestedCounts(classified, 'category')),
        markdownTable('Description length bucket', nestedCounts(classified, 'lengthBucket')),
        markdownTable('Embedded description image count', nestedCounts(classified, 'embeddedCount')),
        markdownTable('Media risk', nestedCounts(classified, 'mediaRisk')),
        '## Policy and safety notes',
        '',
        '- Accessory/component exclusions are applied to explicit terms for accessories, mounting/installation parts, plumbing parts, hardware, replacement parts, bases, supports, drains, valves, handles, hoses, screws, seals, brackets and related low-value components.',
        '- A product is not rewritten merely because its name contains `bồn cầu` or `lavabo`; it must be a complete approved-family product and satisfy both source-evidence gates.',
        '- Missing or duplicate raw SKU is a blocker row and is never guessed. Snapshot blocker counts are preserved in the private input and manifest.',
        '- Accepted Phase-B media checkpoint artifacts are unchanged. This artifact reports inventory/gating only and performs no media relabeling or production mutation.',
        '- Public artifact contains no raw HTML, live media URL, secret, connection value or PII. Private file is ignored and contains only minimum inventory metadata for later proposal work.',
        '',
    ]

    await fs.mkdir(path.dirname(publicManifestPath), { recursive: true })
    await fs.writeFile(publicManifestPath, `${JSON.stringify(publicManifest, null, 2)}\n`, 'utf8')
    await fs.writeFile(publicReportPath, reportLines.join('\n'), 'utf8')
    await fs.writeFile(privateOutputPath, `${JSON.stringify(privateValue, null, 2)}\n`, 'utf8')
    console.log(`PHASE_C_INVENTORY_PASS products=${classified.length} rewriteImportant=${rewriteRows.length} contentReviewCandidate=${candidateRows.length} keepExisting=${classified.length - rewriteRows.length - candidateRows.length} snapshotHash=${snapshot.snapshotHash} manifestChecksum=${manifestChecksum} sourceCommit=${sourceCommit}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase C inventory failed'); process.exitCode = 1 })
