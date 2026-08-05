import { cleanupProductHtml } from './cleanup'
import { createReviewImage, isBunnyAsset, isHitaHostedAsset, normalizeImageUrl } from './images'
import { sha256, stableStringify } from './hash'
import type { PrecomputedProposalPackage, PrecomputedProposalRecord } from './precomputed'
import type { ContentReviewProposal } from './types'

export type DashboardVisibility = 'public' | 'private'

export interface DashboardMedia {
    kind: 'main' | 'gallery' | 'embedded'
    sourceId: string
    fingerprint: string
    policy: string
    decision: string
    host: 'Bunny CDN' | 'Hita' | 'External'
    urlRedacted: string
    url?: string
    altText?: string
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
    return `<span class="media-placeholder" data-media-fingerprint="${escapeHtml(media.fingerprint)}">${escapeHtml(warning)}</span>`
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
    safe = safe.replace(/<a\b[^>]*href=(?:"[^"]*"|'[^']*')[^>]*>([\s\S]*?)<\/a>/gi, '<span>$1</span>')
    safe = safe.replace(/<img\b([^>]*?)\bsrc=(?:"([^"]*)"|'([^']*)')([^>]*)>/gi, (_match, before: string, doubleUrl: string | undefined, singleUrl: string | undefined, after: string) => {
        const url = doubleUrl || singleUrl || ''
        const item = findMedia(mediaByUrl, url)
        if (!item || visibility === 'public' || item.host === 'Hita' || !item.url) return item ? mediaPlaceholder(item, visibility) : '<span class="media-placeholder">Media preview redacted</span>'
        const alt = /\balt=(?:"([^"]*)"|'([^']*)')/i.exec(`${before}${after}`)
        return `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(alt?.[1] || alt?.[2] || item.sourceId)}" loading="lazy" referrerpolicy="no-referrer">`
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
    return record.media.map(item => {
        const reviewImage = createReviewImage(item.kind, item.url)
        const host = hostForUrl(item.url)
        return {
            kind: item.kind,
            sourceId: item.sourceId,
            fingerprint: reviewImage.fingerprint,
            policy: reviewImage.policy,
            decision: reviewImage.decision,
            host,
            urlRedacted: `[redacted URL sha256=${sha256(normalizeImageUrl(item.url))}]`,
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
        manifestChecksum: packageValue.manifestChecksum,
        manifestEntryHash: packageValue.manifestEntryHash,
        products,
    }
}

export function buildDeterministicReviewExport(model: DashboardModel, state: ReviewDecisionState = {}): string {
    const productDecisions = state.products || {}
    const imageDecisions = state.images || {}
    const payload = {
        schemaVersion: 1,
        dashboard: model.dashboard,
        packageHash: model.packageHash,
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
.toolbar { display:grid; grid-template-columns:2fr repeat(5, minmax(120px,1fr)); gap:8px; padding:12px; margin-bottom:14px; } input, select { min-width:0; border:1px solid var(--line); border-radius:7px; padding:9px; background:#fff; color:var(--ink); } label { display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); font-weight:700; }
.layout { display:grid; grid-template-columns:minmax(280px, .8fr) minmax(0, 2fr); gap:14px; align-items:start; } .list { padding:10px; max-height:calc(100vh - 260px); overflow:auto; position:sticky; top:10px; } .product-card { width:100%; text-align:left; margin-bottom:8px; padding:12px; } .product-card.selected { outline:2px solid var(--green); } .product-card .row { display:flex; justify-content:space-between; gap:8px; } .product-card strong { font-size:14px; } .badge { display:inline-flex; border-radius:999px; padding:3px 7px; font-size:10px; font-weight:800; background:#edf3ee; color:var(--muted); } .badge.hita { background:#fff0d5; color:var(--amber); } .badge.keep { background:#e4f5eb; color:var(--green); } .badge.pending { background:#eef1f4; color:#58636d; }
.detail { padding:18px; min-width:0; } .detail-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:14px; margin-bottom:14px; } .detail-head select { min-width:160px; } .meta { display:flex; flex-wrap:wrap; gap:6px; } .meta .badge { border:1px solid var(--line); background:#fff; } .content-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; } .content-box { min-width:0; border:1px solid var(--line); border-radius:10px; padding:13px; background:#fbfdfb; } .content-box.full { grid-column:1/-1; } .rendered { overflow:auto; max-height:420px; line-height:1.55; } .rendered img { max-width:100%; height:auto; border-radius:6px; } .rendered table { border-collapse:collapse; width:100%; } .rendered td,.rendered th { border:1px solid var(--line); padding:5px; } .rendered a { color:var(--green); } .media-placeholder { display:inline-flex; min-height:42px; align-items:center; padding:10px; background:#edf3ee; border:1px dashed #a9bdaf; color:var(--muted); border-radius:6px; font-size:12px; }
.diff { white-space:pre-wrap; overflow:auto; max-height:280px; background:#17221c; color:#d7f5dd; padding:12px; border-radius:8px; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; } .diff .minus { color:#ffaaa0; } .diff .plus { color:#b2f1bc; }
.manifest { width:100%; border-collapse:collapse; font-size:12px; } .manifest th,.manifest td { text-align:left; padding:8px; border-bottom:1px solid var(--line); vertical-align:top; } .manifest th { color:var(--muted); font-size:11px; } .manifest code { word-break:break-all; } .manifest select { padding:5px; } .media-warning { display:block; color:var(--amber); margin-top:5px; font-size:11px; } .media-view { display:block; margin-top:5px; } .media-view img { max-width:180px; max-height:120px; border-radius:6px; }
details { margin-top:10px; } summary { cursor:pointer; color:var(--green); font-weight:700; } .empty { padding:28px; text-align:center; color:var(--muted); } @media (max-width:1000px) { .stats { grid-template-columns:repeat(3,1fr); } .toolbar { grid-template-columns:repeat(3,1fr); } .toolbar label:first-child { grid-column:1/-1; } .layout { grid-template-columns:1fr; } .list { position:static; max-height:340px; } } @media (max-width:650px) { .app { padding:12px; } header,.detail-head { flex-direction:column; } .stats { grid-template-columns:repeat(2,1fr); } .toolbar,.content-grid { grid-template-columns:1fr; } }
`

const DASHBOARD_SCRIPT = (modelJson: string) => `
const MODEL = ${modelJson};
const STORAGE_KEY = "leo-489-pilot-dashboard:v1:" + MODEL.packageHash;
const state = loadState();
let selectedId = MODEL.products[0]?.id;
const $ = (id) => document.getElementById(id);
function loadState() { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return { products: value.products || {}, images: value.images || {} }; } catch (_) { return { products: {}, images: {} }; } }
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ products: state.products, images: state.images })); }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => { if (char === "&") return "&amp;"; if (char === "<") return "&lt;"; if (char === ">") return "&gt;"; if (char === String.fromCharCode(34)) return "&quot;"; return "&#39;"; }); }
function productDecision(product) { return state.products[String(product.id)] || "PENDING"; }
function imageDecision(product, media) { return state.images[product.id + ":" + media.sourceId] || media.decision; }
function badge(value) { const kind = String(value).toLowerCase().includes("hita") ? "hita" : String(value).toLowerCase().includes("keep") ? "keep" : "pending"; return '<span class="badge ' + kind + '">' + esc(value) + '</span>'; }
function currentMediaCounts() { return MODEL.products.flatMap((product) => product.media).reduce((out, media) => { const value = imageDecision({id: media.productId || 0}, media); out[value] = (out[value] || 0) + 1; return out; }, {}); }
function renderStats(filteredCount) { const all = MODEL.products; const reviewed = all.filter((product) => productDecision(product) !== "PENDING").length; const media = all.flatMap((product) => product.media.map((item) => ({ product, item }))); const human = media.filter(({product,item}) => imageDecision(product,item) === "HUMAN_REVIEW").length; const keep = media.filter(({product,item}) => imageDecision(product,item) === "KEEP").length; $("stats").innerHTML = '<div class="stat"><span>Products</span><strong>' + all.length + '</strong><small>exact approved manifest</small></div><div class="stat"><span>Product review progress</span><strong>' + reviewed + '/' + all.length + '</strong><small>local decisions</small></div><div class="stat"><span>HUMAN_REVIEW media</span><strong>' + human + '</strong><small>of ' + media.length + ' total</small></div><div class="stat"><span>KEEP media</span><strong>' + keep + '</strong><small>existing Bunny</small></div><div class="stat"><span>Visible products</span><strong>' + filteredCount + '</strong><small>active filters</small></div>'; }
function values(field) { return [...new Set(MODEL.products.map((product) => product[field]))].sort((a,b) => a.localeCompare(b)); }
function addOptions(id, valuesList, label) { const element = $(id); element.innerHTML = '<option value="">' + label + '</option>' + valuesList.map((value) => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join(""); }
function getFilters() { return { search: $("search").value.toLocaleLowerCase().trim(), brand: $("brand").value, category: $("category").value, status: $("status").value, risk: $("risk").value }; }
function filteredProducts() { const filter = getFilters(); return MODEL.products.filter((product) => { const haystack = [product.sku, product.name, product.brand, product.category].join(" ").toLocaleLowerCase(); return (!filter.search || haystack.includes(filter.search)) && (!filter.brand || product.brand === filter.brand) && (!filter.category || product.category === filter.category) && (!filter.status || productDecision(product) === filter.status) && (!filter.risk || product.mediaRisk === filter.risk); }); }
function renderList(products) { $("product-list").innerHTML = products.length ? products.map((product) => '<button class="product-card ' + (product.id === selectedId ? 'selected' : '') + '" data-product-id="' + product.id + '"><div class="row"><strong>' + esc(product.sku) + '</strong>' + badge(productDecision(product)) + '</div><div>' + esc(product.name) + '</div><div class="subtle">' + esc(product.brand) + ' · ' + esc(product.category) + '</div><div class="meta">' + badge(product.mediaRisk) + ' <span class="subtle">' + product.media.length + ' media</span></div></button>').join("") : '<div class="empty">No products match the current filters.</div>'; }
function diffHtml(product) { if (!product.diff) return '<div class="subtle">No diff telemetry.</div>'; const before = product.beforeHtml.replace(/<[^>]+>/g, " ").replace(/\\s+/g," ").trim(); const after = product.afterHtml.replace(/<[^>]+>/g, " ").replace(/\\s+/g," ").trim(); return '<div class="subtle">Algorithm: ' + esc(product.diff.algorithm) + ' · +' + product.diff.addedCharacters + ' / -' + product.diff.removedCharacters + ' characters · common prefix ' + product.diff.commonPrefixCharacters + ' · common suffix ' + product.diff.commonSuffixCharacters + '</div><pre class="diff"><span class="minus">- ' + esc(before) + '</span>\\n<span class="plus">+ ' + esc(after) + '</span></pre>'; }
function renderMediaPreview(product, media) { const decision = imageDecision(product, media); if (MODEL.privateMedia && media.host === "Bunny CDN" && media.url) return '<span class="media-view bunny-view" data-product-id="' + product.id + '" data-source-id="' + esc(media.sourceId) + '"></span>'; if (MODEL.privateMedia && media.host === "Hita") return '<button class="media-view hita-view" data-product-id="' + product.id + '" data-source-id="' + esc(media.sourceId) + '">View Hita asset manually</button><span class="media-warning">Warning: Hita-hosted; no request is made until this explicit click.</span>'; return '<span class="media-view">' + (media.host === "Hita" ? 'Hita asset URL withheld; explicit view is available only in the ignored private dashboard.' : 'Preview redacted in committed dashboard.') + '</span>'; }
function renderDetail(product) { if (!product) { $("detail").innerHTML = '<div class="empty">Select a product.</div>'; return; } const productSelect = '<select id="product-decision"><option>PENDING</option><option>KEEP</option><option>HUMAN_REVIEW</option><option>REJECT</option></select>'; $("detail").innerHTML = '<div class="detail-head"><div><div class="eyebrow">Product ' + product.id + '</div><h2>' + esc(product.name) + '</h2><div class="subtle">SKU ' + esc(product.sku) + ' · ' + esc(product.brand) + ' · ' + esc(product.category) + '</div><div class="meta">' + badge(product.mediaRisk) + ' ' + badge(product.manifestMediaClass) + '</div></div><label>Product decision' + productSelect + '</label></div><div class="content-grid"><section class="content-box"><h3>Before</h3><div class="rendered">' + product.beforeHtml + '</div></section><section class="content-box"><h3>After</h3><div class="rendered">' + product.afterHtml + '</div></section><section class="content-box full"><h3>Deterministic Diff</h3>' + diffHtml(product) + '</section><section class="content-box full"><h3>Rendered sanitized Preview</h3><div class="rendered">' + product.previewHtml + '</div><p class="subtle">Preview is sanitized and media-gated; it does not apply changes or write remotely.</p></section><section class="content-box full"><h3>Complete media manifest (' + product.media.length + ')</h3><table class="manifest"><thead><tr><th>Kind / source</th><th>Host / risk</th><th>Fingerprint</th><th>Decision</th><th>Preview</th></tr></thead><tbody>' + product.media.map((media) => '<tr><td><strong>' + esc(media.kind) + '</strong><br><code>' + esc(media.sourceId) + '</code></td><td>' + badge(media.host) + '<br><span class="subtle">' + esc(media.policy) + '</span></td><td><code>' + esc(media.fingerprint) + '</code><br><span class="subtle">' + esc(media.urlRedacted) + '</span></td><td><select class="image-decision" data-product-id="' + product.id + '" data-source-id="' + esc(media.sourceId) + '"><option>KEEP</option><option>HUMAN_REVIEW</option><option>REMOVE</option><option>REPLACE</option></select></td><td>' + renderMediaPreview(product, media) + '</td></tr>').join("") + '</tbody></table></section><details class="content-box full"><summary>Factual / provenance indicators</summary><p class="subtle">Source: ' + esc(product.provenance.source) + '</p><p class="subtle">Source record: <code>' + esc(product.provenance.sourceRecordHash) + '</code></p><p class="subtle">Input: <code>' + esc(product.provenance.inputHash) + '</code></p><p class="subtle">Before: <code>' + esc(product.provenance.beforeDescriptionHash) + '</code> · After: <code>' + esc(product.provenance.afterDescriptionHash) + '</code></p><p class="subtle">Facts: <code>' + esc(product.provenance.factsHash) + '</code> · Media inventory: <code>' + esc(product.provenance.mediaInventoryHash) + '</code></p></details></div>'; $("product-decision").value = productDecision(product); document.querySelectorAll(".image-decision").forEach((element) => { const key = element.dataset.productId + ":" + element.dataset.sourceId; element.value = state.images[key] || product.media.find((media) => media.sourceId === element.dataset.sourceId)?.decision || "HUMAN_REVIEW"; element.addEventListener("change", () => { state.images[key] = element.value; persist(); render(); }); }); $("product-decision").addEventListener("change", (event) => { state.products[String(product.id)] = event.target.value; persist(); render(); }); document.querySelectorAll(".bunny-view").forEach((holder) => { const media = product.media.find((item) => item.sourceId === holder.dataset.sourceId); if (!media?.url) return; const image = document.createElement("img"); image.src = media.url; image.alt = media.sourceId; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; holder.appendChild(image); }); document.querySelectorAll(".hita-view").forEach((button) => button.addEventListener("click", () => { const media = product.media.find((item) => item.sourceId === button.dataset.sourceId); if (!media?.url || !window.confirm("Hita-hosted media will be fetched only now. Continue for this single asset?")) return; const image = document.createElement("img"); image.src = media.url; image.alt = media.sourceId; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; button.replaceWith(image); })); }
function render() { const products = filteredProducts(); renderStats(products.length); renderList(products); const selected = products.find((product) => product.id === selectedId) || products[0]; if (selected) selectedId = selected.id; renderDetail(selected); }
function downloadExport() { const payload = { schemaVersion: 1, dashboard: MODEL.dashboard, packageHash: MODEL.packageHash, manifestChecksum: MODEL.manifestChecksum, products: MODEL.products.map((product) => ({ productId: product.id, sku: product.sku, decision: productDecision(product), images: product.media.map((media) => ({ kind: media.kind, sourceId: media.sourceId, fingerprint: media.fingerprint, decision: imageDecision(product,media) })) })).sort((a,b) => a.productId-b.productId) }; const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,nested]) => [key,stable(nested)])) : value; const content = JSON.stringify(stable(payload), null, 2) + "\\n"; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], {type:"application/json"})); link.download = "leo-489-review-decisions.json"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); }
function resetDecisions() { if (!window.confirm("Clear local review decisions for this package?")) return; state.products = {}; state.images = {}; persist(); render(); }
addOptions("brand", values("brand"), "All brands"); addOptions("category", values("category"), "All categories"); addOptions("risk", values("mediaRisk"), "All media risk"); ["search","brand","category","status","risk"].forEach((id) => $(id).addEventListener("input", render)); $("export").addEventListener("click", downloadExport); $("reset").addEventListener("click", resetDecisions); document.addEventListener("click", (event) => { const button = event.target.closest("[data-product-id]"); if (button && button.classList.contains("product-card")) { selectedId = Number(button.dataset.productId); render(); } }); render();
`

export function renderDashboardHtml(model: DashboardModel, visibility: DashboardVisibility = 'public'): string {
    const dashboardModel = visibility === 'private' ? { ...model, privateMedia: true } : model
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LEO-489 Pilot Review Dashboard</title><style>${DASHBOARD_CSS}</style></head>
<body><main class="app"><header><div><div class="eyebrow">Offline · ${visibility === 'private' ? 'private local visual review' : 'PR-safe sanitized review'}</div><h1>LEO-489 Pilot Review Dashboard</h1><p class="subtle">Exact 20-product actual-data proposal package · browser-local decisions only · package <code>${escapeHtml(model.packageHash)}</code></p></div><div class="actions"><button class="primary" id="export">Export deterministic JSON</button><button class="danger" id="reset">Reset local decisions</button></div></header><div class="notice"><strong>Safety boundary:</strong> This file is offline and proposal-only. It never writes a server, database, product, CDN or analytics endpoint. Hita-hosted media stay unloaded until an explicit single-asset click in the ignored private dashboard.</div><section class="stats" id="stats"></section><section class="panel toolbar"><label>Search SKU, name, brand or category<input id="search" type="search" placeholder="e.g. INAX or SFV-802S"></label><label>Brand<select id="brand"></select></label><label>Category<select id="category"></select></label><label>Review status<select id="status"><option value="">All statuses</option><option>PENDING</option><option>KEEP</option><option>HUMAN_REVIEW</option><option>REJECT</option></select></label><label>Media risk<select id="risk"></select></label></section><section class="layout"><aside class="panel list" id="product-list"></aside><article class="panel detail" id="detail"></article></section></main><script>${DASHBOARD_SCRIPT(serializedModel(dashboardModel))}</script></body></html>\n`
}
