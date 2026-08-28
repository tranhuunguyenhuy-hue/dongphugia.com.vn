const baseUrl = process.env.LEO542_BASE_URL
const publishableKey = process.env.LEO542_PUBLISHABLE_KEY
const adminEmail = process.env.LEO542_ADMIN_EMAIL
const adminPassword = process.env.LEO542_ADMIN_PASSWORD
const machineEmail = process.env.LEO542_MACHINE_EMAIL
const machinePassword = process.env.LEO542_MACHINE_PASSWORD
const categoryId = Number(process.env.LEO542_CATEGORY_ID)
const mediaId = process.env.LEO542_MEDIA_ID

if (!baseUrl || !publishableKey || !adminEmail || !adminPassword || !machineEmail || !machinePassword || !Number.isInteger(categoryId) || !mediaId) {
  throw new Error('LEO542_ACCEPTANCE_CONFIGURATION_MISSING')
}

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const result = { ok: false, run, checks: [], fixtures: {}, auth: {}, errors: [] }
let adminToken
let machineToken

function safeBody(body) {
  if (!body || typeof body !== 'object') return {}
  return body
}

async function parseResponse(response) {
  const text = await response.text()
  try {
    return safeBody(JSON.parse(text))
  } catch {
    return {}
  }
}

async function login(email, password) {
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await parseResponse(response)
  if (!response.ok || typeof body.access_token !== 'string') throw new Error('AUTH_LOGIN_FAILED')
  return body.access_token
}

async function functionRequest(functionName, method, path, token, body, idempotencyKey) {
  const headers = { apikey: publishableKey }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, requestId: response.headers.get('x-request-id'), body: await parseResponse(response) }
}

function check(name, pass, detail = {}) {
  result.checks.push({ name, pass: Boolean(pass), ...detail })
  if (!pass) throw new Error(`CHECK_FAILED:${name}`)
}

function bodyCode(response) {
  return response.body?.error?.code ?? response.body?.code ?? null
}

function bodyMessage(response) {
  return response.body?.error?.message ?? response.body?.message ?? null
}

function expectStatus(name, response, status, extra = {}) {
  check(name, response.status === status, { status: response.status, expected: status, code: bodyCode(response), ...extra })
}

function expectData(response) {
  return response.body?.data
}

function expectCanonical(name, row, expected) {
  check(name, Boolean(row), { found: Boolean(row) })
  for (const [field, value] of Object.entries(expected)) check(`${name}.${field}`, row?.[field] === value, { actual: row?.[field], expected: value })
}

async function logout(token) {
  if (!token) return
  await fetch(`${baseUrl}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  })
}

try {
  expectStatus('unauthenticated admin read denied', await functionRequest('admin-products', 'GET', '?limit=1', undefined), 401)
  expectStatus('invalid bearer denied', await functionRequest('admin-products', 'GET', '?limit=1', 'invalid-invalid-invalid'), 401)

  adminToken = await login(adminEmail, adminPassword)
  machineToken = await login(machineEmail, machinePassword)
  result.auth = { admin_login: true, machine_login: true }

  expectStatus('admin content snapshot read', await functionRequest('admin-content', 'GET', '', adminToken), 200)
  expectStatus('admin product list read', await functionRequest('admin-products', 'GET', '?limit=1', adminToken), 200)
  expectStatus('admin commerce read', await functionRequest('admin-commerce', 'GET', '?resource=orders&limit=1', adminToken), 200)
  expectStatus('machine cannot use admin products', await functionRequest('admin-products', 'GET', '?limit=1', machineToken), 403)

  const adminBlogInput = {
    title: `LEO-542 synthetic blog ${run}`,
    slug: `leo542-${run}`,
    excerpt: 'LEO-542 synthetic excerpt',
    content: 'LEO-542 synthetic canonical blog content',
    category_id: categoryId,
    seo_title: 'LEO-542 synthetic blog',
    seo_description: 'LEO-542 synthetic description',
    seo_keywords: 'leo542,synthetic',
    author_name: 'LEO-542 Acceptance',
    status: 'draft',
    is_featured: false,
    is_pinned: false,
  }
  const adminBlogCreateKey = `leo542-admin-blog-create-${run}`
  const adminBlogCreate = await functionRequest('admin-blog', 'POST', '', adminToken, { input: adminBlogInput }, adminBlogCreateKey)
  expectStatus('admin blog draft create', adminBlogCreate, 201)
  const adminBlog = expectData(adminBlogCreate)
  result.fixtures.admin_blog_id = adminBlog?.id
  check('admin blog create returned id', Number.isInteger(adminBlog?.id))
  check('admin blog draft version', adminBlog?.version === 1, { actual: adminBlog?.version })

  const adminBlogRead = await functionRequest('admin-blog', 'GET', `?id=${adminBlog.id}`, adminToken)
  expectStatus('admin blog canonical read', adminBlogRead, 200)
  expectCanonical('admin blog canonical fields', expectData(adminBlogRead), {
    title: adminBlogInput.title,
    slug: adminBlogInput.slug,
    content: adminBlogInput.content,
    status: 'draft',
    version: 1,
  })

  const adminBlogReplay = await functionRequest('admin-blog', 'POST', '', adminToken, { input: adminBlogInput }, adminBlogCreateKey)
  expectStatus('admin blog duplicate create replay', adminBlogReplay, 201)
  check('admin blog duplicate response stable', JSON.stringify(expectData(adminBlogReplay)) === JSON.stringify(adminBlog), {
    first: adminBlog,
    replay: expectData(adminBlogReplay),
  })

  const adminBlogPublishKey = `leo542-admin-blog-publish-${run}`
  const adminBlogPublishInput = { status: 'published' }
  const adminBlogPublish = await functionRequest('admin-blog', 'PATCH', '', adminToken, {
    id: adminBlog.id,
    expected_version: 1,
    input: adminBlogPublishInput,
  }, adminBlogPublishKey)
  expectStatus('admin blog draft to publish', adminBlogPublish, 200)
  const adminBlogPublished = expectData(adminBlogPublish)
  check('admin blog published state', adminBlogPublished?.status === 'published', { actual: adminBlogPublished?.status })
  check('admin blog published version', adminBlogPublished?.version === 2, { actual: adminBlogPublished?.version })

  const adminBlogPublishReplay = await functionRequest('admin-blog', 'PATCH', '', adminToken, {
    id: adminBlog.id,
    expected_version: 1,
    input: adminBlogPublishInput,
  }, adminBlogPublishKey)
  expectStatus('admin blog duplicate publish replay', adminBlogPublishReplay, 200)
  check('admin blog duplicate publish response stable', JSON.stringify(expectData(adminBlogPublishReplay)) === JSON.stringify(adminBlogPublished))

  const adminBlogPublishMismatch = await functionRequest('admin-blog', 'PATCH', '', adminToken, {
    id: adminBlog.id,
    expected_version: 1,
    input: { status: 'published', excerpt: 'LEO-542 mismatch' },
  }, adminBlogPublishKey)
  expectStatus('admin blog idempotency mismatch rejected', adminBlogPublishMismatch, 409)
  check('admin blog idempotency mismatch code', bodyCode(adminBlogPublishMismatch) === 'IDEMPOTENCY_KEY_REUSED', { code: bodyCode(adminBlogPublishMismatch) })

  const productInput = {
    sku: `LEO542-${run}`,
    name: `LEO-542 synthetic product ${run}`,
    slug: `leo542-product-${run}`,
    category_id: categoryId,
    description: 'LEO-542 synthetic canonical product description',
    image_main_url: 'https://cdn.invalid/leo542-synthetic.webp',
    is_active: false,
    publication_status: 'draft',
    pdp_visibility: 'hidden',
    listing_visibility: 'hidden',
    search_visibility: 'hidden',
    seo_indexing: 'noindex',
    sitemap_include: false,
  }
  const productCreate = await functionRequest('admin-products', 'POST', '', adminToken, { input: productInput }, `leo542-admin-product-create-${run}`)
  expectStatus('admin product draft create', productCreate, 201)
  const product = expectData(productCreate)
  result.fixtures.product_id = product?.id
  check('admin product create returned id', Number.isInteger(product?.id))
  check('admin product draft version', product?.version === 1, { actual: product?.version })
  const productPublish = await functionRequest('admin-products', 'PATCH', '', adminToken, {
    id: product.id,
    expected_version: 1,
    input: { publication_status: 'public', pdp_visibility: 'hidden', listing_visibility: 'hidden', search_visibility: 'hidden', seo_indexing: 'noindex', sitemap_include: false, is_active: false },
  }, `leo542-admin-product-publish-${run}`)
  expectStatus('admin product draft to publish', productPublish, 200)
  check('admin product published state', expectData(productPublish)?.publication_status === 'public', { actual: expectData(productPublish)?.publication_status })
  check('admin product published version', expectData(productPublish)?.version === 2, { actual: expectData(productPublish)?.version })
  const productRead = await functionRequest('admin-products', 'GET', `?id=${product.id}`, adminToken)
  expectStatus('admin product canonical read', productRead, 200)
  expectCanonical('admin product canonical fields', expectData(productRead), {
    sku: productInput.sku,
    slug: productInput.slug,
    description: productInput.description,
    publication_status: 'public',
    pdp_visibility: 'hidden',
    version: 2,
  })

  const machineList = await functionRequest('publishing-posts', 'GET', '?limit=1', machineToken)
  expectStatus('publishing post list read', machineList, 200)
  const machineMediaList = await functionRequest('publishing-media', 'GET', '?limit=100', machineToken)
  expectStatus('publishing media list read', machineMediaList, 200)
  check('machine media fixture visible', Array.isArray(expectData(machineMediaList)) && expectData(machineMediaList).some((item) => item.id === mediaId))

  const machinePostInput = {
    title: `LEO-542 machine blog ${run}`,
    slug: `leo542-machine-${run}`,
    excerpt: 'LEO-542 machine synthetic excerpt',
    content: 'LEO-542 machine synthetic canonical content',
    category_id: categoryId,
    external_id: `leo542-machine-external-${run}`,
    status: 'draft',
  }
  const machinePostCreate = await functionRequest('publishing-posts', 'PUT', '', machineToken, { input: machinePostInput }, `leo542-machine-post-create-${run}`)
  expectStatus('machine blog draft create', machinePostCreate, 200)
  const machinePost = expectData(machinePostCreate)
  result.fixtures.machine_blog_id = machinePost?.id
  check('machine blog create returned id', Number.isInteger(machinePost?.id))
  check('machine blog draft version', machinePost?.version === 1, { actual: machinePost?.version })
  expectStatus('admin cannot publish through machine endpoint', await functionRequest('publishing-posts', 'PUT', '', adminToken, { id: machinePost.id, expected_version: 1, input: { status: 'published' } }, `leo542-admin-machine-denial-${run}`), 403)

  const mediaReference = await functionRequest('publishing-media', 'POST', '', machineToken, { post_id: machinePost.id, media_id: mediaId, usage: 'inline' }, `leo542-media-reference-${run}`)
  expectStatus('machine media reference', mediaReference, 200)
  check('media reference preserved', expectData(mediaReference)?.preserved === true, { data: expectData(mediaReference) })
  const mediaReplay = await functionRequest('publishing-media', 'POST', '', machineToken, { post_id: machinePost.id, media_id: mediaId, usage: 'inline' }, `leo542-media-reference-${run}`)
  expectStatus('duplicate media reference replay', mediaReplay, 200)
  check('duplicate media reference stable', JSON.stringify(expectData(mediaReplay)) === JSON.stringify(expectData(mediaReference)))

  const machinePublish = await functionRequest('publishing-posts', 'PUT', '', machineToken, {
    id: machinePost.id,
    expected_version: 1,
    input: { status: 'published' },
  }, `leo542-machine-post-publish-${run}`)
  expectStatus('machine blog draft to publish', machinePublish, 200)
  check('machine blog published state', expectData(machinePublish)?.status === 'published', { actual: expectData(machinePublish)?.status })
  check('machine blog published version', expectData(machinePublish)?.version === 2, { actual: expectData(machinePublish)?.version })
  const machinePostRead = await functionRequest('publishing-posts', 'GET', `?id=${machinePost.id}`, machineToken)
  expectStatus('machine blog canonical read', machinePostRead, 200)
  expectCanonical('machine blog canonical fields', expectData(machinePostRead), {
    title: machinePostInput.title,
    slug: machinePostInput.slug,
    content: machinePostInput.content,
    external_id: machinePostInput.external_id,
    status: 'published',
    version: 2,
  })

  const concurrentCreate = await functionRequest('publishing-posts', 'PUT', '', machineToken, {
    input: { ...machinePostInput, title: `LEO-542 concurrent ${run}`, slug: `leo542-concurrent-${run}`, external_id: `leo542-concurrent-external-${run}`, status: 'draft' },
  }, `leo542-concurrent-create-${run}`)
  expectStatus('concurrent publish fixture create', concurrentCreate, 200)
  const concurrentPost = expectData(concurrentCreate)
  result.fixtures.concurrent_blog_id = concurrentPost?.id
  const concurrentBody = { id: concurrentPost.id, expected_version: 1, input: { status: 'published' } }
  const concurrentResponses = await Promise.all([
    functionRequest('publishing-posts', 'PUT', '', machineToken, concurrentBody, `leo542-concurrent-a-${run}`),
    functionRequest('publishing-posts', 'PUT', '', machineToken, concurrentBody, `leo542-concurrent-b-${run}`),
  ])
  const concurrentStatuses = concurrentResponses.map((response) => response.status).sort((a, b) => a - b)
  check('concurrent publish one winner one stale loser', concurrentStatuses[0] === 200 && concurrentStatuses[1] === 412, { statuses: concurrentStatuses, codes: concurrentResponses.map(bodyCode) })
  const concurrentRead = await functionRequest('publishing-posts', 'GET', `?id=${concurrentPost.id}`, machineToken)
  expectStatus('concurrent publish final read', concurrentRead, 200)
  check('concurrent publish final canonical state', expectData(concurrentRead)?.status === 'published' && expectData(concurrentRead)?.version === 2, { data: expectData(concurrentRead) })

  const staleBlogFailure = await functionRequest('admin-blog', 'PATCH', '', adminToken, {
    id: adminBlog.id,
    expected_version: 1,
    input: { excerpt: 'LEO-542 stale failure probe' },
  }, `leo542-stale-blog-failure-${run}`)
  expectStatus('stale blog mutation rejected', staleBlogFailure, 412)
  check('stale blog failure preserves canonical data', bodyCode(staleBlogFailure) === 'STALE_VERSION')
  const blogAfterStaleFailure = await functionRequest('admin-blog', 'GET', `?id=${adminBlog.id}`, adminToken)
  expectStatus('blog read after stale failure', blogAfterStaleFailure, 200)
  check('blog stale failure preserved', expectData(blogAfterStaleFailure)?.excerpt === adminBlogInput.excerpt && expectData(blogAfterStaleFailure)?.version === 2, { actual: expectData(blogAfterStaleFailure) })

  const staleProductFailure = await functionRequest('admin-products', 'PATCH', '', adminToken, {
    id: product.id,
    expected_version: 1,
    input: { description: 'LEO-542 stale failure probe' },
  }, `leo542-stale-product-failure-${run}`)
  expectStatus('stale product mutation rejected', staleProductFailure, 412)
  check('stale product failure preserves canonical data', bodyCode(staleProductFailure) === 'STALE_VERSION')
  const productAfterStaleFailure = await functionRequest('admin-products', 'GET', `?id=${product.id}`, adminToken)
  expectStatus('product read after stale failure', productAfterStaleFailure, 200)
  check('product stale failure preserved', expectData(productAfterStaleFailure)?.description === productInput.description && expectData(productAfterStaleFailure)?.version === 2, { actual: expectData(productAfterStaleFailure) })

  const audit = await functionRequest('admin-audit', 'GET', '?limit=100', adminToken)
  expectStatus('admin audit read', audit, 200)
  const auditData = expectData(audit)
  check('audit admin stream present', Array.isArray(auditData?.admin))
  check('audit publishing stream present', Array.isArray(auditData?.publishing))
  const auditRows = [...(auditData?.admin ?? []), ...(auditData?.publishing ?? [])]
  check('audit evidence includes blog and product activity', auditRows.some((row) => row.entity_type === 'product' || row.action?.includes('product')) && auditRows.some((row) => row.post_id === adminBlog.id || row.entity_type === 'blog_post' || row.action?.includes('post.')))

  result.ok = true
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : 'LEO542_ACCEPTANCE_FAILED')
} finally {
  await logout(machineToken)
  await logout(adminToken)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
