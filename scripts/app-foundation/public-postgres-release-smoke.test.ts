import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const sourceSha = 'a'.repeat(40)
const script = 'scripts/app-foundation/public-postgres-release-smoke.mjs'

function send(response: ServerResponse, source: string, type: string, status = 200) {
  response.writeHead(status, { 'content-type': type, 'x-dpg-source-sha': sourceSha, 'cache-control': 'no-store' })
  response.end(source)
}

async function createFixture({ failPlp = false, failImage = false, blogCount = 10, includeBlogHeading = true, duplicateLastArticle = false }: {
  failPlp?: boolean; failImage?: boolean; blogCount?: number; includeBlogHeading?: boolean; duplicateLastArticle?: boolean
} = {}) {
  const hits: string[] = []
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname
    hits.push(path)
    if (path === '/api/health') {
      return send(response, JSON.stringify({
        status: 'ok', catalogueMode: 'postgresql', publicProducts: 5964,
        listingProducts: 5362, publishedBlogs: 10,
      }), 'application/json')
    }
    if (path === '/') {
      return send(response, '<main><h1>Đông Phú Gia</h1><a href="https://www.dongphugia.vn">Trang chủ</a></main>', 'text/html')
    }
    if (path === '/thiet-bi-ve-sinh') {
      return send(response, '<main><h1>Thiết bị vệ sinh</h1><a href="/thiet-bi-ve-sinh/voi-sen">Vòi sen</a><a href="/thiet-bi-ve-sinh/bon-cau">Bồn cầu</a></main>', 'text/html')
    }
    if (path === '/api/catalogue/listings/thiet-bi-ve-sinh/voi-sen'
      || path === '/api/catalogue/listings/thiet-bi-ve-sinh/bon-cau') {
      return send(response, JSON.stringify({
        contract: 'dpg:public-catalogue-listing-shard:v1', totalCount: 1,
        products: [{ sku: 'A-LFV-402S-1', image_main_url: `http://127.0.0.1:${server.address()?.port}/images/product.png` }],
      }), 'application/json')
    }
    if (path === '/thiet-bi-ve-sinh/bon-cau') {
      const html = '<html><head><link rel="canonical" href="https://www.dongphugia.vn/thiet-bi-ve-sinh/bon-cau"></head><body><h1>Bồn cầu</h1></body></html>'
      return failPlp
        ? send(response, '<html><head><title>Internal Server Error</title></head><body>private diagnostics</body></html>', 'text/html', 500)
        : send(response, html, 'text/html')
    }
    if (path === '/thiet-bi-ve-sinh/voi-sen') {
      return send(response, '<html><head><link rel="canonical" href="https://www.dongphugia.vn/thiet-bi-ve-sinh/voi-sen"></head><body><h1>Vòi sen</h1></body></html>', 'text/html')
    }
    if (path === '/api/search') {
      return send(response, JSON.stringify({
        total: 1,
        results: [{ sku: 'A-LFV-402S-1', url: '/thiet-bi-ve-sinh/bon-cau/product-one', price: null,
          price_display: 'Liên hệ báo giá', image_main_url: `http://127.0.0.1:${server.address()?.port}/images/product.png` }],
      }), 'application/json')
    }
    if (path === '/tim-kiem') return send(response, '<main><h1>Tìm kiếm sản phẩm</h1><p>A-LFV-402S-1</p></main>', 'text/html')
    if (path === '/thiet-bi-ve-sinh/bon-cau/product-one') {
      return send(response, '<main><h1>Sản phẩm</h1><p>A-LFV-402S-1</p><p>Liên hệ báo giá</p></main>', 'text/html')
    }
    if (path === '/blog') {
      const articles = Array.from({ length: blogCount }, (_, index) => {
        const articleNumber = duplicateLastArticle && index === blogCount - 1 ? blogCount - 1 : index + 1
        return `<a href="/blog/kien-thuc/bai-viet-${articleNumber}">Bài viết ${articleNumber}</a>`
      }).join('')
      const heading = includeBlogHeading ? '<h1>Các bài viết đã xuất bản</h1>' : ''
      const count = `<p>Đang hiển thị <!-- -->${blogCount}<!-- --> bài viết được khôi phục từ dữ liệu website trước đây.</p>`
      return send(response, `<main>${heading}${count}${articles}<img src="/images/blog.png"></main>`, 'text/html')
    }
    if (/^\/blog\/kien-thuc\/bai-viet-[1-9][0-9]*$/.test(path)) {
      return send(response, '<article><h1>Bài viết</h1></article>', 'text/html')
    }
    if (path.startsWith('/images/')) {
      if (failImage) {
        response.writeHead(503, { 'content-type': 'text/plain' })
        response.end('private image origin diagnostics')
      } else {
        response.writeHead(200, { 'content-type': 'image/png' })
        response.end(Buffer.from([137, 80, 78, 71]))
      }
      return
    }
    return send(response, 'Not Found', 'text/plain', 404)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture listener unavailable')
  return {
    base: `http://127.0.0.1:${address.port}`,
    hits,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  }
}

async function runSmoke(base: string) {
  try {
    const result = await execFileAsync(process.execPath, [script, base, sourceSha, 'local'], { maxBuffer: 2_000_000 })
    return { ...result, exitCode: 0 }
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: number }
    return { stdout: failure.stdout ?? '', stderr: failure.stderr ?? '', exitCode: Number(failure.code ?? 1) }
  }
}

function httpRecords(output: string) {
  return output.split(/\r?\n/).flatMap(line => {
    const prefix = 'PUBLIC_POSTGRES_SMOKE_HTTP '
    if (!line.startsWith(prefix)) return []
    try { return [JSON.parse(line.slice(prefix.length))] } catch { return [] }
  })
}

describe('packaged Public PostgreSQL release smoke', () => {
  it('requires canonical PLP HTML and keeps PDP, SKU search, ten blogs, and images in the pass path', async () => {
    const fixture = await createFixture()
    try {
      const result = await runSmoke(fixture.base)
      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0)
      expect(result.stdout).toContain('PUBLIC_POSTGRES_SMOKE status=PASS')
      expect(fixture.hits).toContain('/thiet-bi-ve-sinh/bon-cau')
      expect(fixture.hits).toContain('/thiet-bi-ve-sinh/voi-sen')
      expect(fixture.hits).toContain('/thiet-bi-ve-sinh/bon-cau/product-one')
      expect(fixture.hits.filter(path => path.startsWith('/blog/kien-thuc/bai-viet-'))).toHaveLength(10)
      expect(fixture.hits.filter(path => path.startsWith('/images/'))).toHaveLength(2)
      const records = httpRecords(result.stderr)
      expect(records.find(record => record.route === 'plp')).toMatchObject({
        slug: 'bon-cau', status: 200, contentType: 'text/html',
        sourceShaMatches: true, hasSetCookie: false, failedChecks: [],
      })
      expect(records.filter(record => record.route === 'blog-article')).toHaveLength(10)
      const blogContent = result.stderr.split(/\r?\n/).find(line => line.startsWith('PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT '))
      expect(blogContent).toContain('"rawExactCountSubstringMatched":false')
      expect(blogContent).toContain('"visibleCount":10')
      expect(blogContent).toContain('"uniqueArticleCount":10')
    } finally {
      await fixture.close()
    }
  })

  it('keeps a missing Blog heading and nine published posts as hard failures', async () => {
    for (const fixtureOptions of [{ includeBlogHeading: false }, { blogCount: 9 }]) {
      const fixture = await createFixture(fixtureOptions)
      try {
        const result = await runSmoke(fixture.base)
        expect(result.exitCode).not.toBe(0)
        expect(result.stderr).toContain('PUBLIC_POSTGRES_SMOKE_BLOG_')
        const record = result.stderr.split(/\r?\n/).find(line => line.startsWith('PUBLIC_POSTGRES_SMOKE_BLOG_CONTENT '))
        expect(record).toBeTruthy()
        if (fixtureOptions.includeBlogHeading === false) {
          expect(record).toContain('"publishedHeadingFound":false')
          expect(result.stderr).toContain('PUBLIC_POSTGRES_SMOKE_BLOG_HEADING')
        } else {
          expect(record).toContain('"visibleCount":9')
          expect(record).toContain('"uniqueArticleCount":9')
          expect(result.stderr).toContain('PUBLIC_POSTGRES_SMOKE_BLOG_VISIBLE_COUNT')
        }
      } finally {
        await fixture.close()
      }
    }
  })

  it('rejects ten article links when only nine URLs are unique', async () => {
    const fixture = await createFixture({ duplicateLastArticle: true })
    try {
      const result = await runSmoke(fixture.base)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('"visibleCount":10')
      expect(result.stderr).toContain('"uniqueArticleCount":9')
      expect(result.stderr).toContain('PUBLIC_POSTGRES_SMOKE_BLOG_COUNT')
    } finally {
      await fixture.close()
    }
  })

  it('keeps image failures strict and emits only safe source, host, status, and MIME evidence', async () => {
    const fixture = await createFixture({ failImage: true })
    try {
      const result = await runSmoke(fixture.base)
      expect(result.exitCode).not.toBe(0)
      const line = result.stderr.split(/\r?\n/).find(value => value.startsWith('PUBLIC_POSTGRES_SMOKE_IMAGE_FAILURE '))
      expect(line).toBeTruthy()
      expect(JSON.parse(line!.slice('PUBLIC_POSTGRES_SMOKE_IMAGE_FAILURE '.length))).toEqual({
        source: 'product', host: 'other', finalHostClass: 'same_host', status: 503,
        contentType: 'text/plain', errorClass: 'http_failure',
      })
      expect(result.stderr).toContain('PUBLIC_POSTGRES_SMOKE_IMAGE')
      expect(result.stderr).not.toContain('private image origin diagnostics')
      expect(result.stderr).not.toContain(fixture.base)
    } finally {
      await fixture.close()
    }
  })

  it('reports the exact PLP response predicate without including arbitrary HTML details', async () => {
    const fixture = await createFixture({ failPlp: true })
    try {
      const result = await runSmoke(fixture.base)
      expect(result.exitCode).not.toBe(0)
      const plp = httpRecords(result.stderr).find(record => record.route === 'plp')
      expect(plp).toMatchObject({
        slug: 'bon-cau', status: 500, contentType: 'text/html',
        sourceShaMatches: true, hasSetCookie: false, failedChecks: ['status'],
        bodyClass: 'html_error_page', safeBodyExcerpt: 'internal_server_error',
      })
      expect(fixture.hits).not.toContain('/thiet-bi-ve-sinh/voi-sen')
      expect(result.stderr).not.toContain('private diagnostics')
      expect(result.stderr).toContain('PUBLIC_POSTGRES_SMOKE_RESPONSE_STATUS')
    } finally {
      await fixture.close()
    }
  })
})
