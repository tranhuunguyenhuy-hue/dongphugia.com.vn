import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { cleanupProductHtml, extractEmbeddedImageUrls } = require('../../src/lib/content-review/cleanup.ts') as typeof import('../../src/lib/content-review/cleanup')
const { createReviewImage, dedupeReviewImages } = require('../../src/lib/content-review/images.ts') as typeof import('../../src/lib/content-review/images')
const { hashObject, sha256 } = require('../../src/lib/content-review/hash.ts') as typeof import('../../src/lib/content-review/hash')
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
import type { ProductContentInput } from '../../src/lib/content-review/types'
import type { PrecomputedProposalPackage, PrecomputedProposalRecord, PrecomputedMediaInput } from '../../src/lib/content-review/precomputed'

type ActualProductRow = ProductContentInput & {
    cleanDescriptionHtml?: string | null
    descriptionIssues?: string[]
    descriptionSource?: string | null
}

const MANUAL_FACTS_BY_SKU: Record<string, Array<[string, string]>> = {
    'AT-30H': [
        ['Dòng sản phẩm', 'Máy nước nóng gián tiếp ATMOR AT-30H / AT-50H / AT-80H'],
        ['Chất liệu', 'Nhựa ABS cách điện'],
        ['Áp lực nước vào', '0.05MPa-0.8MPa'],
        ['Công suất', '1.5 – 3kW'],
        ['Dây cấp nước', 'Inox 40cm'],
        ['Dung tích các phiên bản', '30L / 50L / 80L'],
        ['Bảo hành', 'Linh kiện điện tử 1 năm; bình chứa 5 năm'],
    ],
}

const REWRITE_OPENINGS: Record<string, string> = {
    M16004: 'Bộ xả bồn tắm American Standard M16004 là phụ kiện thoát nước cho bồn tắm. Thiết kế gọn, chất liệu nhựa và đường ống thoát hỗ trợ việc lắp đặt, sử dụng và vệ sinh thuận tiện.',
    'AC-7110501': 'Bộ xả bồn tắm American Standard AC-7110501 tập trung vào chức năng thoát nước và điều khiển nắp xả. Cụm nút xả tràn, tay vặn, dây cáp và ống thoát có thể kéo dài giúp phù hợp nhiều vị trí lắp đặt.',
    'AC-7110400': 'Bộ xả bồn tắm American Standard AC-7110400 là phụ kiện thoát nước có thiết kế gọn. Cụm nút xả tràn kết hợp tay vặn và dây cáp giúp thao tác đóng mở nắp xả rõ ràng trong quá trình sử dụng.',
    'WF-9089-CHROME': 'Sen cây nóng lạnh American Standard WF-9089 (WF9089) thuộc bộ sưu tập Simplica, kết hợp thân sen và bát sen phun mưa. Cấu hình đồng, lớp mạ Crom/Nikel, tay sen nhiều chế độ và kích thước lắp đặt được trình bày theo hồ sơ sản phẩm.',
    AT1157: 'Bồn cầu 1 khối ATMOR AT1157 có thân kín, nắp đóng êm và hệ thống xả Siphon Jet. Cấu hình xả nhấn hai mức nước cùng kích thước và tâm xả cụ thể giúp đối chiếu trước khi lựa chọn, lắp đặt.',
    MT5140: 'Bồn tắm góc massage Caesar MT5140 sử dụng vật liệu Acrylic, thiết kế chân yếm và kích thước 1410 x 1410 x 600 mm. Hồ sơ sản phẩm ghi nhận cấu hình massage, nguồn điện và các thông tin lắp đặt đi kèm.',
    'BFV-3003-1C': 'Bộ vòi sen tắm nóng lạnh INAX BFV-3003-1C dùng van điều khiển ceramic, tay sen có chức năng phun tia massage và lớp mạ Cr-Ni. Nội dung được sắp xếp lại để dễ đối chiếu chế độ, áp lực và xuất xứ.',
    SW6181HSG: 'Bồn tiểu nam đặt sàn cảm ứng Cynthia MOEN SW6181HSG kết hợp thân sứ, cảm biến và cơ chế xả tự động. Các thông tin về kích thước, khoảng cách cảm ứng, nguồn điện và lượng nước xả được giữ theo hồ sơ sản phẩm.',
    'CS326DT10#XW': 'Bồn cầu 2 khối TOTO CS326DT10#XW đi kèm nắp đóng êm TOTO TC395VS. Phần mô tả mới ưu tiên cấu hình thân cầu, hệ thống xả Tornado, mức nước 4.5/3L, kích thước và các mã sản phẩm liên quan.',
    V93: 'Bồn cầu thông minh 1 khối Viglacera V93 có nắp điện tử, nguồn điện 220V và hệ thống xả tự động. Kích thước, áp lực nước, mức xả, tâm xả và lớp men theo hồ sơ được trình bày thành các mục đối chiếu rõ ràng.',
    'INAX-20B/CRB-1': 'Gạch ốp tường I-Concept CERABORDER INAX-20B/CRB có dạng que, lấy cảm hứng từ bề mặt đá sỏi. Thông tin kích thước vỉ, độ dày, quy cách đóng thùng, số viên và keo dán đi kèm được giữ nguyên theo dữ liệu sản phẩm.',
    'INAX-255/VIZ-1': 'Gạch ốp tường 255-VIZ INAX-255VIZ là dòng mosaic với viên gạch kích thước 95 x 45 mm. Mô tả mới tập trung vào quy cách vỉ, độ dày, khối lượng thùng và định mức vỉ trên mét vuông.',
    'SFV-802S': 'Vòi bếp INAX SFV-802S là vòi nóng lạnh lắp trên chậu hoặc mặt bàn, thân đồng và cổ vòi cao. Các thông tin về áp lực, kích thước, chiều cao đầu vòi và chế độ xả được tách thành bảng thông tin dễ kiểm tra.',
    'SFV-900SX': 'Vòi bếp dây rút nóng lạnh INAX SFV-900SX có đầu vòi hai chế độ, khả năng xoay 360 độ và dây kéo tối đa 400 mm. Mô tả mới sắp xếp lại vật liệu, lớp mạ, áp lực, kích thước và tiện ích dây rút.',
    TX707AC: 'Lô bàn chải TOTO TX707AC thuộc dòng Curio, kết hợp thủy tinh với đồng mạ Niken-Crom. Kích thước Ø67 x 95 mm, lớp mạ và thông tin bảo hành được trình bày ngắn gọn để đối chiếu khi chọn phụ kiện phòng tắm.',
    'EGR-V2SP/G3': 'Keo dán gạch INAX EGR-V2SP/G3 là keo dán ngoại thất dạng tuýp 2 kg, gốc Urethane resin. Các chỉ số định mức, độ nhớt và độ bền cắt được giữ đúng theo hồ sơ để hỗ trợ kiểm tra vật liệu trước khi thi công.',
    '61-1361-VN': 'Cụm tay cầm INAX 61-1361-VN là phụ kiện thay thế cho vòi bếp INAX SFV-29 và SFV-30. Mã phụ kiện và phạm vi tương thích được đưa lên đầu để giảm nhầm lẫn khi đối chiếu.',
    'A-SFV1013SX-1-1': 'Đầu vòi phun INAX A-SFV1013SX-1-1 là phụ kiện thay thế cho vòi bếp INAX SFV-1013SX. Mô tả mới giữ nguyên mã sản phẩm, tên phụ kiện và thiết bị tương thích trong dữ liệu hiện có.',
    'TBW07001A/TBV01407B/TBN01001B': 'Set sen tắm âm tường TOTO TBW07001A/TBV01407B/TBN01001B dùng chế độ nhiệt độ và một đường nước. Bộ sản phẩm gồm bát sen TBW07001A, van điều chỉnh nhiệt độ TBV01407B cùng phụ kiện âm tường TBN01001B.',
    'AT-30H': 'Máy nước nóng gián tiếp ATMOR AT-30H thuộc nhóm sản phẩm có các phiên bản AT-30H, AT-50H và AT-80H. Mô tả mới gom các thông số về vật liệu, áp lực nước, công suất, dung tích, kích thước và bảo hành để dễ so sánh.',
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function scalarText(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
    return JSON.stringify(value)
}

function factItems(row: ActualProductRow): Array<[string, string]> {
    const items: Array<[string, string]> = []
    for (const fact of row.structuredFacts || []) {
        const label = scalarText(fact.definitionLabel || fact.definitionKey || fact.rawKey)
        const value = scalarText(fact.optionValue || fact.valueText || fact.valueNumber || fact.rawValue || fact.valueJson)
        if (!label || !value || /hita|https?:\/\//i.test(`${label} ${value}`)) continue
        items.push([label, value])
    }
    for (const item of MANUAL_FACTS_BY_SKU[row.sku] || []) items.push(item)
    const seen = new Set<string>()
    return items.filter(([label, value]) => {
        const key = `${label}:${value}`.toLocaleLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function buildAfterHtml(row: ActualProductRow): { html: string; requiredFacts: string[] } {
    const facts = [['SKU', row.sku] as [string, string], ...factItems(row)]
    const brand = row.brand?.name || ''
    const requiredFacts = [brand, row.sku, ...facts.flatMap(([, value]) => [value])]
        .filter(value => value && !/hita|https?:\/\//i.test(value))
    const factList = facts.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('')
    const embeddedHtml = extractEmbeddedImageUrls(row.descriptionHtml).map((url, index) =>
        `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(`${row.name} - hình ${index + 1}`)}"></figure>`,
    ).join('')
    const raw = [
        `<h2>${escapeHtml(row.name)}</h2>`,
        `<p>${escapeHtml(REWRITE_OPENINGS[row.sku] || `${row.name} là sản phẩm ${brand} chính hãng. Nội dung dưới đây được sắp xếp lại từ mô tả và dữ liệu kỹ thuật hiện có.`)} Thông tin được trình bày từ hồ sơ sản phẩm chính hãng.</p>`,
        '<h3>Thông tin đối chiếu</h3>',
        `<ul>${factList}</ul>`,
        embeddedHtml,
    ].join('')
    return { html: cleanupProductHtml(raw), requiredFacts }
}

function buildMedia(row: ActualProductRow): PrecomputedMediaInput[] {
    return [
        ...(row.imageMainUrl ? [{ kind: 'main' as const, url: row.imageMainUrl, sourceId: 'main' }] : []),
        ...(row.galleryImages || []).map(image => ({
            kind: 'gallery' as const,
            url: image.url,
            sourceId: `gallery:${image.id ?? image.sortOrder ?? image.url}`,
        })),
        ...extractEmbeddedImageUrls(row.descriptionHtml).map((url, index) => ({
            kind: 'embedded' as const,
            url,
            sourceId: `embedded:${index}`,
        })),
    ]
}

function createRecord(entry: (typeof LEO_489_PILOT_MANIFEST)[number], row: ActualProductRow): PrecomputedProposalRecord {
    if (row.id !== entry.id || row.sku !== entry.sku || row.brand?.slug !== entry.brandSlug) {
        throw new Error(`Actual product identity does not match manifest for ${entry.id}`)
    }
    const media = buildMedia(row)
    const after = buildAfterHtml(row)
    const mediaInventory = media.map(item => ({ kind: item.kind, sourceId: item.sourceId, url: item.url }))
    const input: ProductContentInput = {
        ...row,
        sourceUrl: row.sourceUrl || `aws-postgresql://products/${row.id}`,
        descriptionHtml: row.descriptionHtml || '',
        galleryImages: row.galleryImages || [],
    }
    return {
        manifest: { ...entry },
        input,
        requiredFacts: after.requiredFacts,
        generatedHtml: after.html,
        media,
        actualInventory: {
            mainCount: media.filter(item => item.kind === 'main').length,
            galleryCount: media.filter(item => item.kind === 'gallery').length,
            embeddedCount: media.filter(item => item.kind === 'embedded').length,
            totalCount: media.length,
        },
        provenance: {
            source: 'aws_postgresql_read_only',
            inputHash: hashObject(input),
            beforeDescriptionHash: hashObject(input.descriptionHtml),
            afterDescriptionHash: hashObject(after.html),
            factsHash: hashObject(after.requiredFacts),
            sourceRecordHash: hashObject(row),
            mediaInventoryHash: hashObject(mediaInventory),
        },
    }
}

function redactMediaUrls(html: string): string {
    return html.replace(/\s+(src|href)="([^"]*)"/gi, (_match, attribute: string, url: string) =>
        ` ${attribute}="[redacted URL sha256=${sha256(url)}]"`,
    )
}

function sanitizeStaticPreview(html: string): string {
    return cleanupProductHtml(html)
        .replace(/https?:\/\/[^\s"'<>]*hita\.com\.vn[^\s"'<>]*/gi, '[Hita URL removed]')
        .replace(/\bhita\b/gi, '[brand reference removed]')
        .replace(/(?<!\d)(?:\+?84|0)\d{8,10}(?!\d)/g, '[contact removed]')
        .replace(/[ \t]+$/gm, '')
}

function mediaLabel(record: PrecomputedProposalRecord): string {
    return record.media.map(item => {
        const image = createReviewImage(item.kind, item.url)
        return `${item.sourceId}: ${item.kind} — ${image.policy} → ${image.decision} — fingerprint ${image.fingerprint}`
    }).join('\n')
}

function buildReviewBundle(
    packageValue: PrecomputedProposalPackage,
    proposals: Awaited<ReturnType<typeof validateAndGeneratePrecomputedProposals>>['proposals'],
): string {
    const recordsById = new Map(packageValue.records.map(record => [record.manifest.id, record]))
    const mediaCounts = packageValue.records.flatMap(record => record.media).reduce((counts, item) => {
        const image = createReviewImage(item.kind, item.url)
        if (image.decision === 'KEEP') counts.bunnyKeep += 1
        if (image.decision === 'HUMAN_REVIEW') counts.humanReview += 1
        return counts
    }, { bunnyKeep: 0, humanReview: 0 })
    const sections = proposals.map((proposal, index) => {
        const record = recordsById.get(proposal.product.id)
        if (!record) throw new Error(`Missing bundle record for ${proposal.product.id}`)
        const telemetry = proposal.generation.telemetry
        const diff = proposal.audit?.diff
        return [
            `## ${index + 1}. ${proposal.product.name}`,
            '',
            `- Product ID: \`${proposal.product.id}\``,
            `- SKU: \`${proposal.product.sku}\``,
            `- Brand/category: \`${record.input.brand?.slug}\` / \`${record.input.category?.slug}\``,
            `- Validation: **PASS**`,
            `- Actual media inventory: main ${record.actualInventory.mainCount}; gallery ${record.actualInventory.galleryCount}; embedded ${record.actualInventory.embeddedCount}; total ${record.actualInventory.totalCount}`,
            '- Exact image decisions:',
            '```text',
            mediaLabel(record),
            '```',
            `- Provenance hashes: source \`${record.provenance.sourceRecordHash}\`; before \`${record.provenance.beforeDescriptionHash}\`; after \`${record.provenance.afterDescriptionHash}\`; facts \`${record.provenance.factsHash}\`; media \`${record.provenance.mediaInventoryHash}\``,
            `- Telemetry: ${telemetry?.beforeCharacters || 0} → ${telemetry?.afterCharacters || 0} characters; token estimate ${telemetry?.beforeTokenEstimate || 0} → ${telemetry?.afterTokenEstimate || 0}`,
            '',
            '### Before (sanitized preview)',
            '',
            '```html',
            redactMediaUrls(sanitizeStaticPreview(record.input.descriptionHtml)),
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
            `- ${redactMediaUrls(sanitizeStaticPreview(record.input.descriptionHtml))}`,
            `+ ${redactMediaUrls(proposal.after.descriptionHtml)}`,
            '```',
            '',
        ].join('\n')
    }).join('\n')
    return [
        '# LEO-489 Pilot Review Bundle',
        '',
        'Sanitized static review bundle generated from the exact read-only AWS PostgreSQL export. It includes actual product identity/category, sanitized Before, worker-authored After, deterministic diff/provenance, and exact per-image decisions identified by source ID and fingerprint. Hita-hosted media are classified without fetching or copying; URLs are redacted in this committed bundle.',
        '',
        `- Manifest checksum: \`${packageValue.manifestChecksum}\``,
        `- Read-only inventory export hash: \`${packageValue.inventoryExportHash}\``,
        `- Manifest entry hash: \`${packageValue.manifestEntryHash}\``,
        `- Package hash: \`${packageValue.packageHash}\``,
        `- Products: ${proposals.length}`,
        `- Total actual media items: ${packageValue.records.reduce((sum, record) => sum + record.actualInventory.totalCount, 0)}`,
        `- Media decisions: ${mediaCounts.humanReview} HUMAN_REVIEW; ${mediaCounts.bunnyKeep} KEEP_EXISTING_BUNNY/KEEP`,
        `- Proposal mode: \`precomputed\``,
        '',
        sections,
    ].join('\n')
}

async function main() {
    const inputPath = process.argv.find(value => value.startsWith('--input='))?.slice('--input='.length)
        || path.join(process.cwd(), 'scripts/content-review/private/leo-489-actual-products.json')
    const packagePath = path.join(process.cwd(), 'scripts/content-review/private/leo-489-pilot-package.json')
    const bundlePath = path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-review.md')
    const rawRows = JSON.parse(await fs.readFile(inputPath, 'utf8')) as ActualProductRow[]
    const rowsById = new Map(rawRows.map(row => [row.id, row]))
    if (rawRows.length !== LEO_489_PILOT_MANIFEST.length || rowsById.size !== LEO_489_PILOT_MANIFEST.length) {
        throw new Error('Actual read-only export must contain exactly 20 unique manifest products')
    }
    const records = LEO_489_PILOT_MANIFEST.map(entry => {
        const row = rowsById.get(entry.id)
        if (!row) throw new Error(`Actual read-only export is missing product ${entry.id}`)
        return createRecord(entry, row)
    })
    const withoutHash = {
        schemaVersion: PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
        source: PRECOMPUTED_PACKAGE_SOURCE,
        manifestChecksum: LEO_489_PILOT_MANIFEST_CHECKSUM,
        inventoryExportHash: hashObject([...rawRows].sort((left, right) => left.id - right.id)),
        manifestEntryHash: pilotManifestEntryHash(),
        records,
    }
    const packageValue: PrecomputedProposalPackage = { ...withoutHash, packageHash: calculatePrecomputedPackageHash(withoutHash) }
    await fs.mkdir(path.dirname(packagePath), { recursive: true })
    await fs.writeFile(packagePath, `${JSON.stringify(packageValue, null, 2)}\n`, 'utf8')
    const validation = await validateAndGeneratePrecomputedProposals(packageValue)
    await fs.mkdir(path.dirname(bundlePath), { recursive: true })
    await fs.writeFile(bundlePath, buildReviewBundle(packageValue, validation.proposals), 'utf8')
    const packageSha256 = require('node:crypto').createHash('sha256').update(JSON.stringify(packageValue, null, 2) + '\n').digest('hex') as string
    console.log(JSON.stringify({
        products: validation.proposals.length,
        manifestChecksum: packageValue.manifestChecksum,
        inventoryExportHash: packageValue.inventoryExportHash,
        packageHash: packageValue.packageHash,
        packageSha256,
        bundlePath: 'docs/review-bundles/leo-489-pilot-review.md',
        mode: 'precomputed',
        validation: 'PASS',
        actualMediaItems: records.reduce((sum, record) => sum + record.actualInventory.totalCount, 0),
        databaseWrites: false,
        hitaAssetsFetched: false,
    }, null, 2))
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
