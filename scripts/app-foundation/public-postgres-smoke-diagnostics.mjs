const SAFE_ROUTES = new Set([
  'health', 'homepage', 'category', 'listing-shard', 'plp', 'search-api',
  'search-page', 'pdp', 'blog-index', 'blog-article', 'image',
])
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SAFE_IMAGE_HOSTS = new Set([
  'www.dongphugia.vn', 'dpg-products.b-cdn.net', 'cdn.dongphugia.com.vn',
  'cdn.hita.com.vn', 'hita.com.vn', 'vietceramics.com',
  'tygjmrhandbffjllxveu.supabase.co', 'media.dongphugia.vn',
])
const SAFE_EXCERPTS = new Map([
  ['Public configuration rejected.', 'public_configuration_rejected'],
  ['Database temporarily unavailable.', 'database_temporarily_unavailable'],
  ['Catalogue temporarily unavailable.', 'catalogue_temporarily_unavailable'],
  ['Internal Server Error', 'internal_server_error'],
  ['Not Found', 'not_found'],
])
const SAFE_JSON_CODES = new Set([
  'PUBLIC_DATABASE_UNAVAILABLE', 'PUBLIC_CATALOGUE_UNAVAILABLE',
  'PUBLIC_PRODUCT_DB_ROW_INVALID', 'PUBLIC_DATABASE_BINDING_REQUIRED',
])

export function classifySmokeBody(contentType, body) {
  const text = String(body ?? '').slice(0, 2_048).trim()
  const mediaType = String(contentType ?? '').split(';', 1)[0].trim().toLowerCase()
  if (!text) return { bodyClass: 'empty' }

  const normalized = text.replace(/\s+/g, ' ')
  if (mediaType === 'text/html' || /<html\b|<!doctype html/i.test(text)) {
    const title = text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    return title && SAFE_EXCERPTS.has(title)
      ? { bodyClass: 'html_error_page', safeBodyExcerpt: SAFE_EXCERPTS.get(title) }
      : { bodyClass: 'html_error_page' }
  }
  if (SAFE_EXCERPTS.has(normalized)) {
    return { bodyClass: 'known_application_error', safeBodyExcerpt: SAFE_EXCERPTS.get(normalized) }
  }
  if (mediaType === 'application/json' || mediaType.endsWith('+json')) {
    let code = ''
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed?.code === 'string' && SAFE_JSON_CODES.has(parsed.code)) code = parsed.code
    } catch { /* Only an allowlisted JSON code may be emitted below. */ }
    return code
      ? { bodyClass: 'json_error', safeBodyExcerpt: code.toLowerCase() }
      : { bodyClass: 'json_error' }
  }
  return { bodyClass: 'other_error_body' }
}

function contentTypeClass(value) {
  if (!value) return 'missing'
  const type = String(value).split(';', 1)[0].trim().toLowerCase()
  if (type === 'text/html' || type === 'application/json' || type === 'text/plain') return type
  if (type.startsWith('image/')) return 'image/*'
  return 'other'
}

export function classifySmokeLocation(value, base) {
  if (!value) return 'missing'
  try {
    const location = new URL(value, base)
    if (location.origin === new URL(base).origin) return 'same_origin'
    if (location.origin === 'https://www.dongphugia.vn') return 'canonical_origin'
    if (location.protocol === 'https:' && SAFE_IMAGE_HOSTS.has(location.hostname)) return 'approved_asset_origin'
    return 'other_origin'
  } catch {
    return 'invalid'
  }
}

export function buildSmokeResponseEvidence({
  route, slug, response, expectedSha, expectedType, base, elapsedMs, body = '',
}) {
  const status = response.status
  const responseContentType = response.headers.get('content-type')
  const sourceShaMatches = response.headers.get('x-dpg-source-sha') === expectedSha
  const hasSetCookie = response.headers.has('set-cookie')
  const failedChecks = []
  if (status !== 200) failedChecks.push('status')
  if (!sourceShaMatches) failedChecks.push('source_sha')
  if (hasSetCookie) failedChecks.push('set_cookie')
  if (!responseContentType?.includes(expectedType)) failedChecks.push('content_type')

  const safeRoute = SAFE_ROUTES.has(route) ? route : 'unknown'
  const safeSlug = typeof slug === 'string' && slug.length <= 64 && SAFE_SLUG.test(slug) ? slug : undefined
  const evidence = {
    route: safeRoute,
    ...(safeSlug ? { slug: safeSlug } : {}),
    status,
    contentType: contentTypeClass(responseContentType),
    sourceShaMatches,
    hasSetCookie,
    redirectLocation: classifySmokeLocation(response.headers.get('location'), base),
    elapsedMs: Math.max(0, Math.round(Number(elapsedMs) || 0)),
    failedChecks,
  }
  if (failedChecks.length) Object.assign(evidence, classifySmokeBody(responseContentType, body))
  return evidence
}

export function buildSmokeNetworkFailureEvidence({ route, slug, error, elapsedMs }) {
  const safeRoute = SAFE_ROUTES.has(route) ? route : 'unknown'
  const safeSlug = typeof slug === 'string' && slug.length <= 64 && SAFE_SLUG.test(slug) ? slug : undefined
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  return {
    route: safeRoute,
    ...(safeSlug ? { slug: safeSlug } : {}),
    status: null,
    contentType: 'missing',
    sourceShaMatches: false,
    hasSetCookie: false,
    redirectLocation: 'missing',
    elapsedMs: Math.max(0, Math.round(Number(elapsedMs) || 0)),
    failedChecks: ['network_request'],
    errorClass: name === 'TimeoutError' || name === 'AbortError' ? 'request_timeout' : 'network_error',
  }
}

function normalizeBlogMainText(html) {
  const main = String(html ?? '').match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
  if (!main) return { mainFound: false, text: '' }
  const text = main
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return { mainFound: true, text }
}

/** Keep only bounded Blog acceptance signals; rendered HTML is never emitted. */
export function buildBlogContentEvidence(html, articlePaths) {
  const { mainFound, text } = normalizeBlogMainText(html)
  const countMatch = text.match(/Đang hiển thị\s+(\d{1,3})\s+bài viết\b/i)
  const visibleCount = countMatch ? Number(countMatch[1]) : null
  const uniqueArticleCount = Array.isArray(articlePaths)
    ? new Set(articlePaths.filter(path => typeof path === 'string')).size
    : 0
  return {
    mainFound,
    publishedHeadingFound: text.includes('Các bài viết đã xuất bản'),
    rawExactCountSubstringMatched: String(html ?? '').includes('10 bài viết'),
    visibleCount: Number.isSafeInteger(visibleCount) && visibleCount >= 0 && visibleCount <= 100 ? visibleCount : null,
    uniqueArticleCount: Number.isSafeInteger(uniqueArticleCount) && uniqueArticleCount <= 100 ? uniqueArticleCount : null,
  }
}
