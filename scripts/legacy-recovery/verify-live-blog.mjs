import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const ORIGIN = 'https://www.dongphugia.vn'
const MAX_HTML_BYTES = 1_000_000
const USER_AGENT = 'DongPhuGia-Public-Blog-Recovery/1.0'

function normalizedText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

async function readPage(path) {
  const url = new URL(path, ORIGIN)
  if (url.origin !== ORIGIN || !/^\/blog\/[a-z0-9-]+\/[a-z0-9-]+$/.test(url.pathname)) {
    throw new Error('LIVE_BLOG_PATH_FORBIDDEN')
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/html', 'Cache-Control': 'no-cache', 'User-Agent': USER_AGENT },
    credentials: 'omit',
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (response.status !== 200 || contentType !== 'text/html' || response.headers.has('set-cookie')
    || contentLength > MAX_HTML_BYTES || !response.body) throw new Error('LIVE_BLOG_RESPONSE_REJECTED')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_HTML_BYTES) {
      await reader.cancel()
      throw new Error('LIVE_BLOG_PAGE_TOO_LARGE')
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

export async function verifyLiveBlogArchive(archive) {
  if (archive.contract !== 'dpg:verified-legacy-blog-snapshot:v1') throw new Error('BLOG_ARCHIVE_CONTRACT_INVALID')
  const categories = new Map(archive.categories.map((category) => [category.id, category]))
  const posts = archive.posts.filter((post) => post.status === 'published' && post.published_at)
  const results = []
  for (const post of posts) {
    const category = categories.get(post.category_id)
    if (!category) throw new Error(`BLOG_CATEGORY_MISSING:${post.id}`)
    const path = `/blog/${category.slug}/${post.slug}`
    const html = await readPage(path)
    const document = new JSDOM(html).window.document
    const title = document.querySelector('main article h1')?.textContent?.trim() ?? null
    const liveBody = normalizedText(document.querySelector('main article .prose')?.textContent ?? '')
    const sourceBody = normalizedText(new JSDOM(post.content).window.document.body.textContent ?? '')
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null
    const expectedCanonical = `${ORIGIN}${path}`
    if (title !== post.title || canonical !== expectedCanonical || liveBody !== sourceBody) {
      throw new Error(`LIVE_BLOG_PARITY_MISMATCH:${post.id}`)
    }
    results.push({ id: post.id, path, status: 'MATCH' })
  }
  return { status: 'PASS', verifiedPublicPages: results.length, results, liveMediaBytesVerified: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = await readFile(new URL('../../apps/public/src/runtime/legacy-blog-snapshot.json', import.meta.url))
  const archive = JSON.parse(bytes.toString('utf8'))
  verifyLiveBlogArchive(archive).then((summary) => process.stdout.write(`${JSON.stringify(summary)}\n`)).catch((error) => {
    const reason = error instanceof Error ? error.message : 'UNKNOWN'
    process.stderr.write(`${JSON.stringify({ status: 'STOP', reason })}\n`)
    process.exitCode = 1
  })
}
