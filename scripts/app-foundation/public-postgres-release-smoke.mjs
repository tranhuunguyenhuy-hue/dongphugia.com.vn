const [baseArgument, sourceSha, posture] = process.argv.slice(2)
const fail = (reason) => { throw new Error(`PUBLIC_POSTGRES_SMOKE_${reason}`) }
if (!/^[a-f0-9]{40}$/.test(sourceSha) || !['local', 'production'].includes(posture)) fail('ARGUMENT')
const base = new URL(baseArgument)
if (posture === 'local' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))) fail('BASE')
if (posture === 'production' && base.origin !== 'https://www.dongphugia.vn') fail('BASE')

async function checked(path, expectedType) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(20000) })
  if (response.status !== 200 || response.headers.get('x-dpg-source-sha') !== sourceSha
    || response.headers.has('set-cookie') || !response.headers.get('content-type')?.includes(expectedType)) fail('RESPONSE')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > 2_000_000) fail('SIZE')
  return { response, body: new TextDecoder().decode(bytes) }
}

const health = await checked('/api/health', 'application/json')
let state
try { state = JSON.parse(health.body) } catch { fail('HEALTH_JSON') }
if (state.status !== 'ok' || state.catalogueMode !== 'postgresql' || state.publicProducts !== 5964
  || state.listingProducts !== 5362 || state.publishedBlogs !== 10) fail('HEALTH')

const home = await checked('/', 'text/html')
if (!home.body.includes('<h1') || !home.body.includes('href="https://www.dongphugia.vn"')) fail('HOME')
const category = await checked('/thiet-bi-ve-sinh', 'text/html')
if (!category.body.includes('<h1')) fail('CATEGORY')
const listingSlugs = [...new Set([...category.body.matchAll(/href=["']\/thiet-bi-ve-sinh\/([a-z0-9]+(?:-[a-z0-9]+)*)["']/g)].map(m => m[1]))]
let selectedListing = null
let listingShard = null
for (const slug of listingSlugs.slice(0, 30)) {
  const candidate = await fetch(new URL(`/api/catalogue/listings/thiet-bi-ve-sinh/${slug}?page=1`, base), {
    redirect: 'manual', signal: AbortSignal.timeout(20000),
  })
  if (candidate.status !== 200 || candidate.headers.get('x-dpg-source-sha') !== sourceSha
    || candidate.headers.has('set-cookie')) continue
  let body
  try { body = await candidate.json() } catch { continue }
  if (body.contract === 'dpg:public-catalogue-listing-shard:v1' && body.totalCount > 0
    && Array.isArray(body.products) && body.products.length > 0) {
    selectedListing = slug
    listingShard = body
    break
  }
}
if (!selectedListing || !listingShard) fail('PLP_API')
const plp = await checked(`/thiet-bi-ve-sinh/${selectedListing}`, 'text/html')
if (!plp.body.includes('<h1')) fail('PLP')

const search = await checked('/api/search?q=A-LFV-402S-1&limit=8', 'application/json')
let searchBody
try { searchBody = JSON.parse(search.body) } catch { fail('SEARCH_JSON') }
const product = searchBody.results?.find(value => value.sku === 'A-LFV-402S-1')
if (!product || typeof product.url !== 'string' || !/^\/(?:thiet-bi-ve-sinh|thiet-bi-bep|vat-lieu-nuoc|gach-op-lat)\/[a-z0-9-]+\/[a-z0-9-]+$/.test(product.url)
  || product.price !== null || product.price_display !== 'Liên hệ báo giá' || searchBody.total < 1) fail('DATABASE_ONLY_SKU')
const searchPage = await checked('/tim-kiem?q=A-LFV-402S-1', 'text/html')
if (!searchPage.body.includes('Tìm kiếm sản phẩm') || !searchPage.body.includes('A-LFV-402S-1')) fail('SEARCH_PAGE')
const pdp = await checked(product.url, 'text/html')
if (!pdp.body.includes('<h1') || !pdp.body.includes('A-LFV-402S-1') || !pdp.body.includes('Liên hệ báo giá')) fail('PDP')

const blog = await checked('/blog', 'text/html')
if (!blog.body.includes('Các bài viết đã xuất bản') || !blog.body.includes('10 bài viết')) fail('BLOG_INDEX')
const articlePaths = [...new Set([...blog.body.matchAll(/href=["'](\/blog\/[a-z0-9-]+\/[a-z0-9-]+)(?:[?#][^"']*)?["']/g)].map(m => m[1]))]
if (articlePaths.length !== 10) fail('BLOG_COUNT')
const articles = []
for (const path of articlePaths) {
  const article = await checked(path, 'text/html')
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
async function checkImage(url) {
  if (!safeHosts.has(url.hostname)) fail('IMAGE_HOST')
  if (url.hostname === 'media.dongphugia.vn'
    && (!url.pathname.startsWith('/publishing/') || url.search || url.hash)) fail('IMAGE_PATH')
  const response = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
  const finalUrl = new URL(response.url)
  if (!safeHosts.has(finalUrl.hostname) || (finalUrl.hostname === 'media.dongphugia.vn' && !finalUrl.pathname.startsWith('/publishing/'))
    || ![200, 206].includes(response.status)
    || !response.headers.get('content-type')?.startsWith('image/')) fail('IMAGE')
  await response.body?.cancel()
}
const productImage = product.image_main_url ? new URL(product.image_main_url, base) : firstImage(pdp.body) ?? firstImage(plp.body)
if (!productImage) fail('PRODUCT_IMAGE_SOURCE')
await checkImage(productImage)
const blogImage = firstImage(blog.body) ?? articles.map(firstImage).find(Boolean)
if (!blogImage) fail('BLOG_IMAGE_SOURCE')
await checkImage(blogImage)

console.log(`PUBLIC_POSTGRES_SMOKE status=PASS posture=${posture} listingProducts=${state.listingProducts} blogs=${articlePaths.length} source=${sourceSha}`)
