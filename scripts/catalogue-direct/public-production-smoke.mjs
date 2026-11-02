// Bounded read-only proof of the Production Worker before and after upload.
const [baseArgument, sourceSha, posture] = process.argv.slice(2)
const productPaths = [
  '/thiet-bi-ve-sinh/lavabo/chau-lavabo-treo-tuong-toto-lt300c',
  '/thiet-bi-bep/voi-rua-chen/voi-bep-toto-tx605kesbr',
  '/vat-lieu-nuoc/loc-nuoc/may-loc-tong-dau-nguon-karofi-ktf-552',
  '/gach-op-lat/gach-op-lat/gach-612en8a',
]
const paths = ['/', '/blog', '/thiet-bi-ve-sinh', '/thiet-bi-bep', '/vat-lieu-nuoc', '/gach-op-lat', ...productPaths]
const fail = (reason) => { throw new Error(`PUBLIC_PRODUCTION_SMOKE_${reason}`) }
if (!/^[a-f0-9]{40}$/.test(sourceSha) || !['local', 'workers-dev'].includes(posture)) fail('ARGUMENT')
const base = new URL(baseArgument)
if (posture === 'local' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))) fail('BASE')
if (posture === 'workers-dev' && !(base.protocol === 'https:' && base.hostname === 'dongphugia-v1-public-production.tranhuunguyenhuy.workers.dev')) fail('BASE')

async function checked(path) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(20000) })
  if (response.status !== 200 || response.headers.get('x-dpg-source-sha') !== sourceSha
    || response.headers.has('set-cookie')) fail('HTTP')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > 2_000_000) fail('SIZE')
  return { response, body: new TextDecoder().decode(bytes) }
}

const health = await checked('/api/health')
let healthBody
try { healthBody = JSON.parse(health.body) } catch { fail('HEALTH_JSON') }
if (healthBody.status !== 'ok' || healthBody.catalogueMode !== 'verified-snapshot'
  || healthBody.publicProducts !== 5223 || healthBody.listingProducts !== 4853) fail('HEALTH')
const robots = await checked('/robots.txt')
if (!robots.body.includes('Allow: /') || robots.body.includes('Disallow: /')) fail('ROBOTS')

for (const path of paths) {
  const { response, body } = await checked(path)
  const canonical = path === '/' ? 'https://www.dongphugia.vn' : `https://www.dongphugia.vn${path}`
  if (!response.headers.get('content-type')?.includes('text/html') || !body.includes('<h1')
    || !body.includes(`href="${canonical}"`) || /<meta[^>]+name="robots"[^>]+noindex/i.test(body)) fail('HTML')
  const robotsHeader = response.headers.get('x-robots-tag')
  if (posture === 'workers-dev' ? robotsHeader !== 'noindex, nofollow' : robotsHeader !== null) fail('INDEX_HEADER')
  if (path === '/' && (!body.includes('1776486977694-87cnaa.png')
    || body.includes('Catalogue khôi phục ở chế độ chỉ đọc')
    || body.includes('Sản phẩm Gạch Ốp Lát'))) fail('HOME_HOTFIX')
  if (path === '/blog' && !body.includes('Bài viết đang được cập nhật')) fail('NEWS_HOTFIX')
}
for (const [assetPath, contentType] of [
  ['/images/banner-1.editorial.w960.webp', 'image/webp'],
  ['/images/banner-1.jpg', 'image/jpeg'],
  ['/images/banner-2.jpg', 'image/jpeg'],
  ['/images/banner-3.jpg', 'image/jpeg'],
]) {
  const image = await fetch(new URL(assetPath, base), { signal: AbortSignal.timeout(20000) })
  if (image.status !== 200 || !image.headers.get('content-type')?.includes(contentType)) fail('HERO_ASSET')
  await image.body?.cancel()
}
// The three Owner-confirmed historical Production banners are public PNG objects.
// Keep the existing local fallback image checks above for a rollback path.
const archiveBannerUrls = [
  'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776486977694-87cnaa.png',
  'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485447824-r0eml8.png',
  'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485426606-t2pflg.png',
]
for (const assetUrl of archiveBannerUrls) {
  let healthy = false
  for (let attempt = 0; attempt < 2 && !healthy; attempt++) {
    try {
      const image = await fetch(assetUrl, { method: 'HEAD', signal: AbortSignal.timeout(20000) })
      healthy = image.status === 200 && image.headers.get('content-type')?.includes('image/png')
    } catch { /* Retry once for transient legacy Storage connectivity. */ }
  }
  if (!healthy) fail('HERO_ARCHIVE')
}
console.log(`PUBLIC_PRODUCTION_SMOKE status=PASS posture=${posture} routes=${paths.length} source=${sourceSha}`)
