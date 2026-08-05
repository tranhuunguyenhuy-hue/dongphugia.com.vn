import { cleanupProductHtml } from './cleanup'
import { createReviewImage, isBunnyAsset, isHitaHostedAsset, normalizeImageUrl } from './images'
import { sha256, stableStringify } from './hash'
import { getEditorialQualityMetrics } from './content-quality'
import { classifyMediaReferences, type MediaClassification, type MediaHost } from './media-classification'
import type { PrecomputedProposalPackage, PrecomputedProposalRecord } from './precomputed'
import type { ContentReviewProposal } from './types'

export type DashboardVisibility = 'public' | 'private'

export interface DashboardMedia {
    kind: 'main' | 'gallery' | 'embedded'
    sourceId: string
    fingerprint: string
    policy: string
    decision: string
    host: MediaHost
    urlRedacted: string
    url?: string
    altText?: string
    classification: MediaClassification
}

export interface DashboardProduct {
    id: number
    sku: string
    name: string
    brand: string
    brandSlug: string
    category: string
    categorySlug: string
    mediaRisk: 'HITA_HOSTED' | 'BUNNY_ONLY' | 'MIXED'
    manifestMediaClass: string
    editorialReview: 'PASS' | 'HUMAN_REVIEW'
    editorialReviewReason: string | null
    editorialQuality: {
        beforeCharacters: number
        afterCharacters: number
        ratio: number
        paragraphCount: number
        buyerBenefitSignals: number
        technicalTableDump: boolean
        repeatedOpeningKey: string
        shortSourceException: boolean
        flags: string[]
    }
    beforeHtml: string
    afterHtml: string
    previewHtml: string
    diff: NonNullable<ContentReviewProposal['audit']>['diff'] | null
    provenance: {
        source: string
        sourceRecordHash: string
        inputHash: string
        beforeDescriptionHash: string
        afterDescriptionHash: string
        factsHash: string
        mediaInventoryHash: string
    }
    media: DashboardMedia[]
}

export interface DashboardModel {
    schemaVersion: 1
    dashboard: 'leo-489-pilot'
    packageHash: string
    proposalHash: string
    policyHash: string
    snapshotHash: string
    sourceCommit: string
    bindingStatus: 'VALID' | 'STALE'
    manifestChecksum: string
    manifestEntryHash: string
    products: DashboardProduct[]
}

export interface ReviewDecisionState {
    products?: Record<string, string>
    images?: Record<string, string>
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function hostForUrl(url: string): DashboardMedia['host'] {
    if (isBunnyAsset(url)) return 'Bunny CDN'
    if (isHitaHostedAsset(url)) return 'Hita'
    return 'External'
}

function mediaPlaceholder(media: DashboardMedia, visibility: DashboardVisibility): string {
    const warning = media.host === 'Hita'
        ? 'Hita-hosted media — manual view only; no automatic fetch'
        : `Media preview redacted in this ${visibility} artifact`
    return `<span class="media-placeholder" data-media-source-id="${escapeHtml(media.sourceId)}" data-media-fingerprint="${escapeHtml(media.fingerprint)}">${escapeHtml(warning)} · placement ${escapeHtml(media.sourceId)}</span>`
}

function findMedia(mediaByUrl: Map<string, DashboardMedia>, url: string): DashboardMedia | undefined {
    return mediaByUrl.get(normalizeImageUrl(url))
}

/** Clean proposal HTML and make its network behavior explicit for the dashboard. */
export function sanitizeHtmlForDashboard(
    html: string,
    media: DashboardMedia[],
    visibility: DashboardVisibility,
): string {
    const mediaByUrl = new Map(media.flatMap(item => item.url ? [[normalizeImageUrl(item.url), item] as const] : []))
    let safe = cleanupProductHtml(html)
    safe = safe.replace(/\[\[MEDIA:([^\]]+)\]\]/g, (_match, sourceId: string) => {
        const item = media.find(candidate => candidate.sourceId === sourceId)
        if (!item) return 'Media placement unavailable'
        return `<span class="media-placement" data-media-source-id="${escapeHtml(sourceId)}">Image placement: ${escapeHtml(item.classification.action)}</span>`
    })
    safe = safe.replace(/<a\b[^>]*href=(?:"[^"]*"|'[^']*')[^>]*>([\s\S]*?)<\/a>/gi, '<span>$1</span>')
    safe = safe.replace(/<img\b([^>]*?)\bsrc=(?:"([^"]*)"|'([^']*)')([^>]*)>/gi, (_match, before: string, doubleUrl: string | undefined, singleUrl: string | undefined, after: string) => {
        const url = doubleUrl || singleUrl || ''
        const item = findMedia(mediaByUrl, url)
        if (!item || visibility === 'public' || item.host === 'Hita' || !item.url) return item ? mediaPlaceholder(item, visibility) : '<span class="media-placeholder">Media preview redacted</span>'
        const alt = /\balt=(?:"([^"]*)"|'([^']*)')/i.exec(`${before}${after}`)
        return `<img src="${escapeHtml(item.url)}" data-media-source-id="${escapeHtml(item.sourceId)}" alt="${escapeHtml(alt?.[1] || alt?.[2] || item.sourceId)}" loading="lazy" referrerpolicy="no-referrer">`
    })
    if (visibility === 'public') {
        safe = safe.replace(/https?:\/\/[^\s"'<>]+/gi, '[external URL redacted]')
        safe = safe.replace(/\b(?:[a-z0-9-]+\.)*hita\.com\.vn\b/gi, '[host redacted]')
    }
    return safe
}

function mediaRisk(media: DashboardMedia[]): DashboardProduct['mediaRisk'] {
    const hasHita = media.some(item => item.host === 'Hita')
    const hasBunny = media.some(item => item.host === 'Bunny CDN')
    if (hasHita && hasBunny) return 'MIXED'
    if (hasHita) return 'HITA_HOSTED'
    return 'BUNNY_ONLY'
}

function createDashboardMedia(record: PrecomputedProposalRecord): DashboardMedia[] {
    const inputs = record.media.map(item => {
        const reviewImage = createReviewImage(item.kind, item.url)
        const host = hostForUrl(item.url)
        return {
            item,
            reviewImage,
            host,
            classificationInput: {
                sku: record.manifest.sku,
                kind: item.kind,
                sourceId: item.sourceId,
                fingerprint: reviewImage.fingerprint,
                host,
            },
        }
    })
    const classifications = classifyMediaReferences(inputs.map(input => input.classificationInput))
    return inputs.map(({ item, reviewImage, host }, index) => {
        const classification = classifications[index]
        return {
            kind: item.kind,
            sourceId: item.sourceId,
            fingerprint: reviewImage.fingerprint,
            policy: reviewImage.policy,
            decision: reviewImage.decision,
            host,
            urlRedacted: `[redacted URL sha256=${sha256(normalizeImageUrl(item.url))}]`,
            classification,
            ...(host === 'Bunny CDN' || host === 'Hita' ? { url: item.url } : {}),
        }
    })
}

function recordForProposal(packageValue: PrecomputedProposalPackage, proposal: ContentReviewProposal): PrecomputedProposalRecord {
    const record = packageValue.records.find(candidate => candidate.manifest.id === proposal.product.id)
    if (!record) throw new Error(`Dashboard proposal is missing package record ${proposal.product.id}`)
    return record
}

export function createDashboardModel(
    packageValue: PrecomputedProposalPackage,
    proposals: ContentReviewProposal[],
    visibility: DashboardVisibility = 'public',
): DashboardModel {
    const products = proposals
        .map(proposal => {
            const record = recordForProposal(packageValue, proposal)
            const media = createDashboardMedia(record)
            const editorialQuality = getEditorialQualityMetrics(proposal.before.descriptionHtml, proposal.after.descriptionHtml)
            return {
                id: proposal.product.id,
                sku: proposal.product.sku,
                name: proposal.product.name,
                brand: record.input.brand?.name || record.manifest.brandSlug,
                brandSlug: record.input.brand?.slug || record.manifest.brandSlug,
                category: record.input.category?.name || record.input.category?.slug || 'Uncategorized',
                categorySlug: record.input.category?.slug || 'uncategorized',
                mediaRisk: mediaRisk(media),
                manifestMediaClass: record.manifest.mediaClass,
                editorialReview: editorialQuality.editorialReview,
                editorialReviewReason: editorialQuality.editorialReviewReason,
                editorialQuality,
                beforeHtml: sanitizeHtmlForDashboard(proposal.before.descriptionHtml, media, visibility),
                afterHtml: sanitizeHtmlForDashboard(proposal.after.descriptionHtml, media, visibility),
                previewHtml: sanitizeHtmlForDashboard(proposal.after.descriptionHtml, media, visibility),
                diff: proposal.audit?.diff || null,
                provenance: record.provenance,
                media: media.map(item => visibility === 'public' ? { ...item, url: undefined } : item),
            }
        })
        .sort((left, right) => left.id - right.id)
    return {
        schemaVersion: 1,
        dashboard: 'leo-489-pilot',
        packageHash: packageValue.packageHash,
        proposalHash: packageValue.packageHash,
        policyHash: packageValue.policyHash,
        snapshotHash: packageValue.snapshotHash,
        sourceCommit: packageValue.sourceCommit,
        bindingStatus: packageValue.policyHash && packageValue.snapshotHash && packageValue.sourceCommit ? 'VALID' : 'STALE',
        manifestChecksum: packageValue.manifestChecksum,
        manifestEntryHash: packageValue.manifestEntryHash,
        products,
    }
}

export function buildDeterministicReviewExport(model: DashboardModel, state: ReviewDecisionState = {}): string {
    if (model.bindingStatus !== 'VALID' || model.proposalHash !== model.packageHash || !model.policyHash || !model.snapshotHash || !model.sourceCommit) {
        throw new Error('Cannot export a stale or incomplete policy/snapshot/proposal binding')
    }
    const productDecisions = state.products || {}
    const imageDecisions = state.images || {}
    const payload = {
        schemaVersion: 1,
        dashboard: model.dashboard,
        packageHash: model.packageHash,
        proposalHash: model.proposalHash,
        policyHash: model.policyHash,
        snapshotHash: model.snapshotHash,
        sourceCommit: model.sourceCommit,
        manifestChecksum: model.manifestChecksum,
        products: model.products.map(product => ({
            productId: product.id,
            sku: product.sku,
            decision: productDecisions[String(product.id)] || 'PENDING',
            images: product.media.map(media => ({
                kind: media.kind,
                sourceId: media.sourceId,
                fingerprint: media.fingerprint,
                decision: imageDecisions[`${product.id}:${media.sourceId}`] || media.decision,
                classification: media.classification,
            })),
        })).sort((left, right) => left.productId - right.productId),
    }
    return `${JSON.stringify(JSON.parse(stableStringify(payload)), null, 2)}\n`
}

function serializedModel(model: DashboardModel): string {
    return JSON.stringify(model)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
}

const DASHBOARD_CSS = `
:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --ink:#14231b; --muted:#5d7065; --line:#dce8df; --panel:#fff; --wash:#f4f8f5; --green:#087443; --amber:#a15c00; --red:#a32d2d; }
* { box-sizing:border-box; } body { margin:0; color:var(--ink); background:var(--wash); } button, input, select { font:inherit; } button { cursor:pointer; }
.app { max-width:1520px; margin:0 auto; padding:24px; } header { display:flex; gap:16px; align-items:flex-start; justify-content:space-between; margin-bottom:18px; } h1,h2,h3 { margin:0 0 8px; } h1 { font-size:clamp(24px,3vw,38px); } h2 { font-size:22px; } h3 { font-size:16px; } .eyebrow { color:var(--green); font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; } .subtle { color:var(--muted); font-size:13px; }
.actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; } button { border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--ink); padding:9px 12px; } button.primary { background:var(--green); border-color:var(--green); color:#fff; } button.danger { color:var(--red); }
.stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:14px; } .stat, .panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:0 2px 8px #193d2610; } .stat { padding:14px; } .stat strong { display:block; font-size:26px; margin-top:4px; } .stat span { color:var(--muted); font-size:12px; }
.notice { border-left:4px solid var(--amber); background:#fff8eb; padding:12px 14px; border-radius:8px; margin-bottom:14px; font-size:13px; } .notice strong { color:var(--amber); }
.toolbar { display:grid; grid-template-columns:2fr repeat(7, minmax(120px,1fr)); gap:8px; padding:12px; margin-bottom:14px; } input, select { min-width:0; border:1px solid var(--line); border-radius:7px; padding:9px; background:#fff; color:var(--ink); } label { display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); font-weight:700; }
.layout { display:grid; grid-template-columns:minmax(280px, .8fr) minmax(0, 2fr); gap:14px; align-items:start; } .list { padding:10px; max-height:calc(100vh - 260px); overflow:auto; position:sticky; top:10px; } .product-card { width:100%; text-align:left; margin-bottom:8px; padding:12px; } .product-card.selected { outline:2px solid var(--green); } .product-card .row { display:flex; justify-content:space-between; gap:8px; } .product-card strong { font-size:14px; } .badge { display:inline-flex; border-radius:999px; padding:3px 7px; font-size:10px; font-weight:800; background:#edf3ee; color:var(--muted); } .badge.hita { background:#fff0d5; color:var(--amber); } .badge.keep { background:#e4f5eb; color:var(--green); } .badge.pending { background:#eef1f4; color:#58636d; }
    .detail { padding:18px; min-width:0; } .detail-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:14px; margin-bottom:14px; } .detail-head select { min-width:160px; } .meta { display:flex; flex-wrap:wrap; gap:6px; } .meta .badge { border:1px solid var(--line); background:#fff; } .content-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; } .content-box { min-width:0; border:1px solid var(--line); border-radius:10px; padding:13px; background:#fbfdfb; } .content-box.full { grid-column:1/-1; } .rendered { overflow:auto; max-height:420px; line-height:1.55; } .rendered img { max-width:100%; height:auto; border-radius:6px; } .rendered table { border-collapse:collapse; width:100%; } .rendered td,.rendered th { border:1px solid var(--line); padding:5px; } .rendered a { color:var(--green); } .media-placeholder,.media-placement { display:inline-flex; min-height:42px; align-items:center; padding:10px; background:#edf3ee; border:1px dashed #a9bdaf; color:var(--muted); border-radius:6px; font-size:12px; }
.diff { white-space:pre-wrap; overflow:auto; max-height:280px; background:#17221c; color:#d7f5dd; padding:12px; border-radius:8px; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; } .diff .minus { color:#ffaaa0; } .diff .plus { color:#b2f1bc; }
    .manifest { width:100%; border-collapse:collapse; font-size:12px; } .manifest th,.manifest td { text-align:left; padding:8px; border-bottom:1px solid var(--line); vertical-align:top; } .manifest th { color:var(--muted); font-size:11px; } .manifest code { word-break:break-all; } .manifest select { padding:5px; } .media-warning { display:block; color:var(--amber); margin-top:5px; font-size:11px; } .media-view { display:block; margin-top:5px; } .media-view img { max-width:180px; max-height:120px; border-radius:6px; }
    .view-tabs { display:flex; gap:8px; margin:14px 0; } .view-tab { border:1px solid var(--line); background:#fff; padding:9px 13px; border-radius:8px; font-weight:800; } .view-tab.active { background:var(--green); color:#fff; border-color:var(--green); } .hidden { display:none !important; } .media-review { margin-top:14px; } .media-review-head { display:flex; justify-content:space-between; align-items:end; gap:12px; margin-bottom:12px; } .media-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; } .media-card { border:1px solid var(--line); border-radius:12px; background:#fff; overflow:hidden; } .media-card .media-frame { min-height:210px; display:grid; place-items:center; background:#edf3ee; padding:10px; } .media-card .media-frame img { width:100%; max-height:260px; object-fit:contain; border-radius:7px; } .media-card .media-body { padding:13px; } .media-card .media-meta { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; } .media-card code { font-size:10px; word-break:break-all; } .media-card .evidence { font-size:12px; line-height:1.45; } .media-card select { width:100%; margin-top:8px; } .media-card .open-content { width:100%; margin-top:8px; border:1px solid var(--line); background:#fff; border-radius:7px; padding:8px; font-weight:700; }
details { margin-top:10px; } summary { cursor:pointer; color:var(--green); font-weight:700; } .empty { padding:28px; text-align:center; color:var(--muted); } @media (max-width:1000px) { .stats { grid-template-columns:repeat(3,1fr); } .toolbar { grid-template-columns:repeat(3,1fr); } .toolbar label:first-child { grid-column:1/-1; } .layout { grid-template-columns:1fr; } .list { position:static; max-height:340px; } } @media (max-width:650px) { .app { padding:12px; } header,.detail-head { flex-direction:column; } .stats { grid-template-columns:repeat(2,1fr); } .toolbar,.content-grid { grid-template-columns:1fr; } }
`

const DASHBOARD_SCRIPT_V31 = (modelJson: string) => `
const MODEL = ${modelJson};
const STORAGE_KEY = "leo-489-pilot-dashboard:v3.1:" + MODEL.proposalHash;
const state = loadState();
let selectedId = MODEL.products[0]?.id;
const $ = (id) => document.getElementById(id);
function loadState() { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return { products: value.products || {}, images: value.images || {} }; } catch (_) { return { products: {}, images: {} }; } }
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ products: state.products, images: state.images })); }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => { if (char === "&") return "&amp;"; if (char === "<") return "&lt;"; if (char === ">") return "&gt;"; if (char === String.fromCharCode(34)) return "&quot;"; return "&#39;"; }); }
function productDecision(product) { return state.products[String(product.id)] || "PENDING"; }
function imageDecision(product, media) { return state.images[product.id + ":" + media.sourceId] || media.classification.action; }
function badge(value) { const text = String(value || ""); const lower = text.toLowerCase(); const kind = lower.includes("xoá") || lower.includes("remove") ? "hita" : lower.includes("giữ") || lower.includes("keep") ? "keep" : "pending"; return '<span class="badge ' + kind + '">' + esc(text) + '</span>'; }
function actionLabel(media) { return media.classification.label || media.classification.action; }
function allMedia() { return MODEL.products.flatMap((product) => product.media.map((item) => ({ product, item }))); }
function renderStats(filteredCount) { const media = allMedia(); const keep = media.filter(({product,item}) => imageDecision(product, item).startsWith("KEEP_")).length; const remove = media.filter(({product,item}) => imageDecision(product, item) === "REMOVE_HITA_SHOWROOM").length; const human = media.filter(({product,item}) => imageDecision(product, item) === "HUMAN_REVIEW").length; const reviewed = MODEL.products.filter((product) => productDecision(product) !== "PENDING").length; $("stats").innerHTML = '<div class="stat"><span>Tổng ảnh</span><strong>' + media.length + '</strong><small>exact 20 sản phẩm</small></div><div class="stat"><span>Giữ</span><strong>' + keep + '</strong><small>hình sản phẩm / bản vẽ</small></div><div class="stat"><span>Xoá Hita</span><strong>' + remove + '</strong><small>showroom/cửa hàng đã xác nhận</small></div><div class="stat"><span>Cần xem</span><strong>' + human + '</strong><small>chỉ khi thật sự chưa rõ</small></div><div class="stat"><span>Tiến độ nội dung</span><strong>' + reviewed + '/' + MODEL.products.length + '</strong><small>' + filteredCount + ' sản phẩm đang lọc</small></div>'; }
function getFilters() { return { search: $("search").value.toLocaleLowerCase().trim(), action: $("action").value, origin: $("origin").value, risk: $("risk").value }; }
function filteredProducts() { const filter = getFilters(); return MODEL.products.filter((product) => { const haystack = [product.sku, product.name].join(" ").toLocaleLowerCase(); const mediaMatches = product.media.some((media) => { const proposed = imageDecision(product, media); return (!filter.action || proposed === filter.action) && (!filter.origin || media.classification.origin === filter.origin) && (!filter.risk || product.mediaRisk === filter.risk); }); return (!filter.search || haystack.includes(filter.search)) && mediaMatches; }); }
function addOptions(id, valuesList, label, labelFor) { const element = $(id); element.innerHTML = '<option value="">' + label + '</option>' + valuesList.map((value) => '<option value="' + esc(value) + '">' + esc(labelFor ? labelFor(value) : value) + '</option>').join(""); }
function renderList(products) { $("product-list").innerHTML = products.length ? products.map((product) => '<button class="product-card ' + (product.id === selectedId ? 'selected' : '') + '" data-product-id="' + product.id + '"><div class="row"><strong>' + esc(product.sku) + '</strong>' + badge(productDecision(product)) + '</div><div>' + esc(product.name) + '</div><div class="subtle">' + esc(product.brand) + ' · ' + esc(product.category) + '</div><div class="meta">' + badge(product.mediaRisk) + ' <span class="subtle">' + product.media.length + ' ảnh</span></div></button>').join("") : '<div class="empty">Không có sản phẩm phù hợp.</div>'; }
function diffHtml(product) { if (!product.diff) return '<div class="subtle">Không có diff telemetry.</div>'; const before = product.beforeHtml.replace(/<[^>]+>/g, " ").replace(/\\s+/g," ").trim(); const after = product.afterHtml.replace(/<[^>]+>/g, " ").replace(/\\s+/g," ").trim(); return '<div class="subtle">Thuật toán: ' + esc(product.diff.algorithm) + ' · +' + product.diff.addedCharacters + ' / -' + product.diff.removedCharacters + ' ký tự</div><pre class="diff"><span class="minus">- ' + esc(before) + '</span>\\n<span class="plus">+ ' + esc(after) + '</span></pre>'; }
function renderMediaPreview(product, media) { if (MODEL.privateMedia && media.host === "Bunny CDN" && media.url) return '<span class="media-view bunny-view" data-product-id="' + product.id + '" data-source-id="' + esc(media.sourceId) + '"></span>'; if (MODEL.privateMedia && media.host === "Hita") return '<button class="media-view hita-view" data-product-id="' + product.id + '" data-source-id="' + esc(media.sourceId) + '">Xem thủ công ảnh Hita</button><span class="media-warning">Chỉ tải một ảnh sau khi bấm; không tự động crawl/copy.</span>'; return '<span class="media-view">' + (media.host === "Hita" ? 'Ảnh Hita chỉ xem trong private dashboard.' : 'Ảnh được ẩn trong public artifact.') + '</span>'; }
function technicalDetails(media) { return '<details><summary>Chi tiết kỹ thuật</summary><p class="subtle">Fingerprint: <code>' + esc(media.fingerprint) + '</code><br>Duplicate: <code>' + esc(media.classification.duplicateFingerprint) + '</code><br>Origin: ' + esc(media.classification.origin) + '<br>Evidence: ' + esc(media.classification.evidence) + '<br>Confidence: ' + esc(media.classification.confidence) + '</p></details>'; }
function actionSelect(product, media, className) { const actions = ["KEEP_PRODUCT","KEEP_TECHNICAL","KEEP_TEMPORARY","REMOVE_HITA_SHOWROOM","HUMAN_REVIEW"]; return '<select class="' + className + '" data-product-id="' + product.id + '" data-source-id="' + esc(media.sourceId) + '">' + actions.map((action) => '<option value="' + action + '"' + (imageDecision(product,media) === action ? ' selected' : '') + '>' + esc(action === media.classification.action ? actionLabel(media) : action) + '</option>').join('') + '</select>'; }
function bindPreview(root, product, media) { const bunny = root.querySelector('.bunny-view'); if (bunny && media.url) { const image = document.createElement('img'); image.src = media.url; image.alt = media.sourceId; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; bunny.appendChild(image); } const hita = root.querySelector('.hita-view'); if (hita) hita.addEventListener('click', () => { if (!media.url || !window.confirm('Chỉ tải đúng một ảnh Hita ngay bây giờ?')) return; const image = document.createElement('img'); image.src = media.url; image.alt = media.sourceId; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; hita.replaceWith(image); }); }
function renderDetail(product) { if (!product) { $("detail").innerHTML = '<div class="empty">Chọn một sản phẩm.</div>'; return; } const placements = [...product.afterHtml.matchAll(/data-media-source-id="([^"]+)"/g)].map((match) => match[1]); $("detail").innerHTML = '<div class="detail-head"><div><div class="eyebrow">Content Review · ' + product.id + '</div><h2>' + esc(product.name) + '</h2><div class="subtle">SKU ' + esc(product.sku) + ' · ' + esc(product.brand) + ' · ' + esc(product.category) + '</div></div><label>Quyết định nội dung<select id="product-decision"><option>PENDING</option><option>KEEP</option><option>HUMAN_REVIEW</option><option>REJECT</option></select></label></div><div class="content-grid"><section class="content-box"><h3>Before</h3><div class="rendered">' + product.beforeHtml + '</div></section><section class="content-box"><h3>After</h3><div class="rendered">' + product.afterHtml + '</div><p class="subtle">Ảnh giữ lại trong After: ' + esc(placements.length ? placements.join(', ') : 'Không có ảnh inline an toàn') + '</p></section><section class="content-box full"><h3>Deterministic Diff</h3>' + diffHtml(product) + '</section><section class="content-box full"><h3>Media của sản phẩm (' + product.media.length + ')</h3>' + product.media.map((media) => '<div class="content-media-row"><strong>' + esc(media.sourceId) + '</strong> · ' + badge(actionLabel(media)) + ' · Current → proposed: ' + esc(media.decision) + ' → ' + esc(actionLabel(media)) + ' ' + actionSelect(product,media,'image-decision') + '</div>').join('') + '</section></div>'; $("product-decision").value = productDecision(product); $("product-decision").addEventListener('change', (event) => { state.products[String(product.id)] = event.target.value; persist(); render(); }); document.querySelectorAll('.image-decision').forEach((element) => element.addEventListener('change', () => { state.images[element.dataset.productId + ':' + element.dataset.sourceId] = element.value; persist(); render(); })); }
function renderMediaReview(products) { const filter = getFilters(); const media = products.flatMap((product) => product.media.filter((item) => (!filter.action || imageDecision(product,item) === filter.action) && (!filter.origin || item.classification.origin === filter.origin)).map((item) => ({ product, item }))); const reviewed = media.filter(({product,item}) => Boolean(state.images[product.id + ':' + item.sourceId])).length; $("media-review").innerHTML = '<div class="media-review-head"><div><div class="eyebrow">Media Review</div><h2>Media Review</h2><p class="subtle">' + media.length + ' ảnh · ' + reviewed + ' quyết định local · Current → proposed và quyết định trực tiếp.</p></div><div class="meta">' + badge('Bunny: xem trực tiếp') + badge('Hita: xem thủ công') + '</div></div><div class="media-grid">' + media.map(({product,item}) => '<article class="media-card" data-product-id="' + product.id + '" data-source-id="' + esc(item.sourceId) + '"><div class="media-frame">' + renderMediaPreview(product,item) + '</div><div class="media-body"><div class="eyebrow">' + esc(product.sku) + ' · ' + esc(item.kind) + '</div><h3>' + esc(product.name) + '</h3><div class="media-meta">' + badge(actionLabel(item)) + '</div><p class="evidence"><strong>Current → proposed:</strong> ' + esc(item.decision) + ' → ' + esc(actionLabel(item)) + '</p>' + actionSelect(product,item,'media-card-decision') + technicalDetails(item) + '<button class="open-content" data-product-id="' + product.id + '">Mở Content / placement</button></div></article>').join('') + '</div>'; document.querySelectorAll('.media-card').forEach((card) => { const product = MODEL.products.find((entry) => entry.id === Number(card.dataset.productId)); const item = product?.media.find((entry) => entry.sourceId === card.dataset.sourceId); if (product && item) bindPreview(card, product, item); }); document.querySelectorAll('.media-card-decision').forEach((element) => element.addEventListener('change', () => { state.images[element.dataset.productId + ':' + element.dataset.sourceId] = element.value; persist(); render(); })); document.querySelectorAll('.open-content').forEach((button) => button.addEventListener('click', () => { selectedId = Number(button.dataset.productId); showView('content'); render(); })); }
function showView(view) { const media = view === 'media'; $("media-review").classList.toggle('hidden', !media); $("content-review").classList.toggle('hidden', media); $("media-tab").classList.toggle('active', media); $("content-tab").classList.toggle('active', !media); }
function render() { const products = filteredProducts(); renderStats(products.length); renderList(products); const selected = products.find((product) => product.id === selectedId) || products[0]; if (selected) selectedId = selected.id; renderDetail(selected); renderMediaReview(products); }
function downloadExport() { if (MODEL.bindingStatus !== 'VALID' || MODEL.proposalHash !== MODEL.packageHash) { window.alert('Artifact binding stale — export blocked.'); return; } const payload = { schemaVersion: 1, dashboard: MODEL.dashboard, proposalHash: MODEL.proposalHash, packageHash: MODEL.packageHash, policyHash: MODEL.policyHash, snapshotHash: MODEL.snapshotHash, sourceCommit: MODEL.sourceCommit, products: MODEL.products.map((product) => ({ productId: product.id, sku: product.sku, decision: productDecision(product), images: product.media.map((media) => ({ kind: media.kind, sourceId: media.sourceId, fingerprint: media.fingerprint, decision: imageDecision(product,media), classification: media.classification })) })).sort((a,b) => a.productId-b.productId) }; const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,nested]) => [key,stable(nested)])) : value; const content = JSON.stringify(stable(payload), null, 2) + "\\n"; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], {type:'application/json'})); link.download = 'leo-489-review-decisions.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); }
function resetDecisions() { if (!window.confirm('Xóa quyết định local của package này?')) return; state.products = {}; state.images = {}; persist(); render(); }
addOptions('action', ['KEEP_PRODUCT','KEEP_TECHNICAL','KEEP_TEMPORARY','REMOVE_HITA_SHOWROOM','HUMAN_REVIEW'], 'Tất cả đề xuất', (value) => value === 'KEEP_PRODUCT' ? 'GIỮ — Hình sản phẩm' : value === 'KEEP_TECHNICAL' ? 'GIỮ — Bản vẽ/HDSD' : value === 'KEEP_TEMPORARY' ? 'GIỮ TẠM — Chưa chứng minh nguồn, không phải showroom Hita' : value === 'REMOVE_HITA_SHOWROOM' ? 'XOÁ — Showroom/cửa hàng Hita' : 'CẦN XEM'); addOptions('origin', [...new Set(MODEL.products.flatMap((product) => product.media.map((media) => media.classification.origin)))].sort(), 'Tất cả origin'); addOptions('risk', [...new Set(MODEL.products.map((product) => product.mediaRisk))].sort(), 'Tất cả rủi ro'); ['search','action','origin','risk'].forEach((id) => $(id).addEventListener('input', render)); $("export").addEventListener('click', downloadExport); $("reset").addEventListener('click', resetDecisions); $("content-tab").addEventListener('click', () => showView('content')); $("media-tab").addEventListener('click', () => showView('media')); document.addEventListener('click', (event) => { const button = event.target.closest('[data-product-id]'); if (button && button.classList.contains('product-card')) { selectedId = Number(button.dataset.productId); render(); } }); showView('media'); render();
`

export function renderDashboardHtml(model: DashboardModel, visibility: DashboardVisibility = 'public'): string {
    const dashboardModel = visibility === 'private' ? { ...model, privateMedia: true } : model
    return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LEO-489 Media Review</title><style>${DASHBOARD_CSS}</style></head>
<body><main class="app"><header><div><div class="eyebrow">Offline · ${visibility === 'private' ? 'private local visual review' : 'public sanitized review'}</div><h1>LEO-489 Media Review</h1><p class="subtle">Exact 20 sản phẩm · quyết định local · proposal <code>${escapeHtml(model.proposalHash)}</code> · policy <code>${escapeHtml(model.policyHash)}</code> · snapshot <code>${escapeHtml(model.snapshotHash)}</code></p><p class="subtle">Binding: <strong>${escapeHtml(model.bindingStatus)}</strong> · source commit <code>${escapeHtml(model.sourceCommit)}</code></p></div><div class="actions"><button class="primary" id="export">Export JSON xác định</button><button class="danger" id="reset">Xóa quyết định local</button></div></header><div class="notice"><strong>Ranh giới an toàn:</strong> offline, proposal-only, không ghi server/database/product/media/CDN. Bunny xem trực tiếp trong private; Hita chỉ manual-load từng ảnh sau click.</div><section class="stats" id="stats"></section><section class="panel toolbar"><label>SKU / sản phẩm<input id="search" type="search" placeholder="Ví dụ: SFV-802S hoặc INAX"></label><label>Đề xuất<select id="action"></select></label><details><summary>Bộ lọc nâng cao</summary><label>Origin<select id="origin"></select></label><label>Risk<select id="risk"></select></label></details></section><nav class="view-tabs" aria-label="Review mode"><button class="view-tab" id="content-tab">Content Review</button><button class="view-tab active" id="media-tab">Media Review</button></nav><section class="layout hidden" id="content-review"><aside class="panel list" id="product-list"></aside><article class="panel detail" id="detail"></article></section><section class="media-review" id="media-review"></section></main><script>${DASHBOARD_SCRIPT_V31(serializedModel(dashboardModel))}</script></body></html>\n`
}
