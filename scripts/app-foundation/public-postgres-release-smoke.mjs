import { buildBlogContentEvidence, buildSmokeImageFailureEvidence, buildSmokeNetworkFailureEvidence, buildSmokeResponseEvidence } from './public-postgres-smoke-diagnostics.mjs'

const [baseArgument, sourceSha, posture] = process.argv.slice(2)
const fail = (reason) => { throw new Error(`PUBLIC_POSTGRES_SMOKE_${reason}`) }
if (!/^[a-f0-9]{40}$/.test(sourceSha) || !['local', 'production'].includes(posture)) fail('ARGUMENT')
const base = new URL(baseArgument)
if (posture === 'local' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))) fail('BASE')
if (posture === 'production' && base.origin !== 'https://www.dongphugia.vn') fail('BASE')

let emittedHttpEvidence = 0
const MAX_HTTP_EVIDENCE = 48
function emitHttpEvidence(evidence) {
  if (emittedHttpEvidence >= MAX_HTTP_EVIDENCE) return
  emittedHttpEvidence += 1
  console.error(`PUBLIC_POSTGRES_SMOKE_HTTP ${JSON.stringify(evidence)}`)
}

async function safeBodyPrefix(response) {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks = []
  let size = 0
  try {
    while (size < 2_048) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const chunk = value.subarray(0, 2_048 - size)
      chunks.push(chunk)
      size += chunk.byteLength
      if (chunk.byteLength < value.byteLength) break
    }
  } catch { /* Failure evidence must not hide the original response check. */ }
  try { await reader.cancel() } catch { /* The bounded diagnostic read is best effort. */ }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

async function checked(path, expectedType, route, slug) {
  const started = performance.now()
  let response
  try {
    response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(20000) })
  } catch (error) {
    emitHttpEvidence(buildSmokeNetworkFailureEvidence({ route, slug, error, elapsedMs: performance.now() - started }))
    fail('REQUEST')
  }
  let evidence = buildSmokeResponseEvidence({
    route, slug, response, expectedSha: sourceSha, expectedType, base,
    elapsedMs: performance.now() - started,
  })
  if (evidence.failedChecks.length) {
    evidence = buildSmokeResponseEvidence({
      route, slug, response, expectedSha: sourceSha, expectedType, base,
      elapsedMs: performance.now() - started, body: await safeBodyPrefix(response),
    })
  }
  emitHttpEvidence(evidence)
  if (evidence.failedChecks.length) fail(`RESPONSE_${evidence.failedChecks[0].toUpperCase()}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > 2_000_000) fail('SIZE')
  return { response, body: new TextDecoder().decode(bytes) }
}

const health = await checked('/api/health', 'application/json', 'health')
let state
try { state = JSON.parse(health.body) } catch { fail('HEALTH_JSON') }
if (state.status !== 'ok' || state.catalogueMode !== 'postgresql' || state.publicProducts !== 5964
  || state.listingProducts !== 5362 || state.publishedBlogs !== 10) fail('HEALTH')

const home = await checked('/', 'text/html', 'homepage')
if (!home.body.includes('<h1') || !home.body.includes('href="https://www.dongphugia.vn"')) fail('HOME')
const category = await checked('/thiet-bi-ve-sinh', 'text/html', 'category')
if (!category.body.includes('<h1')) fail('CATEGORY')
const listingSlugs = [...new Set([...category.body.matchAll(/href=["']\/thiet-bi-ve-sinh\/([a-z0-9]+(?:-[a-z0-9]+)*)["']/g)].map(m => m[1]))]
let selectedListing = null
let listingShard = null
for (const slug of listingSlugs.slice(0, 30)) {
  const candidateResult = await checked(`/api/catalogue/listings/thiet-bi-ve-sinh/${slug}?page=1`, 'application/json', 'listing-shard', slug)
    .catch(error => {
      if (/PUBLIC_POSTGRES_SMOKE_(?:REQUEST|RESPONSE_)/.test(String(error?.message))) return null
      throw error
    })
  if (!candidateResult) continue
  let body
  try { body = JSON.parse(candidateResult.body) } catch { continue }
  if (body.contract === 'dpg:public-catalogue-listing-shard:v1' && body.totalCount > 0
    && Array.isArray(body.products) && body.products.length > 0) {
    selectedListing = slug
    listingShard = body
    break
  }
}
if (!selectedListing || !listingShard) fail('PLP_API')
if (!listingSlugs.includes('bon-cau')) fail('INCIDENT_PLP_LISTING')
async function checkedCanonicalPlp(slug) {
  const plp = await checked(`/thiet-bi-ve-sinh/${slug}`, 'text/html', 'plp', slug)
  if (!plp.body.includes('<h1')) fail('PLP')
  const canonicalTag = plp.body.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0]
  const canonicalHref = canonicalTag?.match(/\bhref=["']([^"']+)["']/i)?.[1]
  if (canonicalHref !== `https://www.dongphugia.vn/thiet-bi-ve-sinh/${slug}`) fail('PLP_CANONICAL')
}
// Keep the previously failing production route in the strict smoke path even
// if a different eligible listing becomes the first dynamically discovered one.
await checkedCanonicalPlp('bon-cau')
if (selectedListing !== 'bon-cau') await checkedCanonicalPlp(selectedListing)

const search = await checked('/api/search?q=A-LFV-402S-1&limit=8', 'application/json', 'search-api')
let searchBody
try { searchBody = JSON.parse(search.body) } catch { fail('SEARCH_JSON') }
const product = searchBody.results?.find(value => value.sku === 'A-LFV-402S-1')
if (!product || typeof product.url !== 'string' || !/^\/(?:thiet-bi-ve-sinh|thiet-bi-bep|vat-lieu-nuoc|gach-op-lat)\/[a-z0-9-]+\/[a-z0-9-]+$/.test(product.url)
  || product.price !== null || product.price_display !== 'Liên hệ báo giá' || searchBody.total < 1) fail('DATABASE_ONLY_SKU')
const searchPage = await checked('/tim-kiem?q=A-LFV-402S-1', 'text/html', 'search-page')
if (!searchPage.body.includes('Tìm kiếm sản phẩm') || !searchPage.body.includes('A-LFV-402S-1')) fail('SEARCH_PAGE')
const pdp = await checked(product.url, 'text/html', 'pdp')
if (!pdp.body.includes('<h1') || !pdp.body.includes('A-LFV-402S-1') || !pdp.body.includes('Liên hệ báo giá')) fail('PDP')

const blog = await checked('/blog', 'text/html', 'blog-index')
const articlePaths = [...new Set([...blog.body.matchAll(/href=["'](\/blog\/[a-z0-9-]+\/[a-z0-9-]+)(?:[?#][^"']*)?["']/g)].map(m => m[1]))]
const blogContent = buildBlogContentEvidence(blog.body, articlePaths)
console.error(`PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT ${JSON.stringify(blogContent)}`)
if (!blogContent.mainFound) fail('BLOG_MAIN')
if (!blogContent.publishedHeadingFound) fail('BLOG_HEADING')
if (blogContent.visibleCount !== 10) fail('BLOG_VISIBLE_COUNT')
if (articlePaths.length !== 10) fail('BLOG_COUNT')
const articles = []
for (const path of articlePaths) {
  const article = await checked(path, 'text/html', 'blog-article')
  if (!article.body.includes('<article') || !article.body.includes('<h1')) fail('BLOG_ARTICLE')
  articles.push(article.body)
}

const safeHosts = new Set([
  'www.dongphugia.vn', 'dpg-products.b-cdn.net', 'cdn.dongphugia.com.vn',
  'cdn.hita.com.vn', 'hita.com.vn', 'vietceramics.com', 'tygjmrhandbffjllxveu.supabase.co',
  'media.dongphugia.vn',
  base.hostname,
])
function firstImage(html) {
  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const source = match[1].replaceAll('&amp;', '&')
    try {
      let url = new URL(source, base)
      if (url.pathname === '/_next/image' && url.searchParams.has('url')) {
        url = new URL(url.searchParams.get('url'), base)
      }
      if (url.hostname === 'tygjmrhandbffjllxveu.supabase.co'
        && !url.pathname.startsWith('/storage/v1/object/public/')) continue
      if (url.hostname === 'media.dongphugia.vn'
        && (!url.pathname.startsWith('/publishing/') || url.search || url.hash)) continue
      if (safeHosts.has(url.hostname) && url.protocol === 'https:') return url
      if (url.origin === base.origin && url.protocol === 'http:') return url
    } catch { /* Ignore malformed image URLs from page content. */ }
  }
  return null
}
async function checkImage(url, source) {
  if (!safeHosts.has(url.hostname)) fail('IMAGE_HOST')
  if (url.hostname === 'media.dongphugia.vn'
    && (!url.pathname.startsWith('/publishing/') || url.search || url.hash)) fail('IMAGE_PATH')
  let response
  try {
    response = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
  } catch (error) {
    console.error(`PUBLIC_POSTGRES_SMOKE_IMAGE_FAILURE ${JSON.stringify(buildSmokeImageFailureEvidence({
      source, host: url.hostname, error,
    }))}`)
    fail('IMAGE_REQUEST')
  }
  const finalUrl = new URL(response.url)
  const responseType = response.headers.get('content-type')
  if (!safeHosts.has(finalUrl.hostname) || (finalUrl.hostname === 'media.dongphugia.vn' && !finalUrl.pathname.startsWith('/publishing/'))
    || ![200, 206].includes(response.status) || !responseType?.startsWith('image/')) {
    await response.body?.cancel()
    console.error(`PUBLIC_POSTGRES_SMOKE_IMAGE_FAILURE ${JSON.stringify(buildSmokeImageFailureEvidence({
      source, host: url.hostname, finalHost: finalUrl.hostname,
      status: response.status, contentType: responseType,
    }))}`)
    fail('IMAGE')
  }
  await response.body?.cancel()
}
const productImage = product.image_main_url ? new URL(product.image_main_url, base) : firstImage(pdp.body) ?? firstImage(plp.body)
if (!productImage) fail('PRODUCT_IMAGE_SOURCE')
await checkImage(productImage, 'product')
const blogImage = firstImage(blog.body) ?? articles.map(firstImage).find(Boolean)
if (!blogImage) fail('BLOG_IMAGE_SOURCE')
await checkImage(blogImage, 'blog')

console.log(`PUBLIC_POSTGRES_SMOKE status=PASS posture=${posture} listingProducts=${state.listingProducts} blogs=${articlePaths.length} source=${sourceSha}`)
