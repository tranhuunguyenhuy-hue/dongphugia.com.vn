import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const root = resolve(process.argv[2] ?? '')
const origin = process.argv[3] ?? ''
if (!root || origin !== 'https://www.dongphugia.vn') throw new Error('PUBLIC_SITEMAP_ARGUMENTS_INVALID')
const catalogue = join(root, '__catalogue/v1')
const manifest = JSON.parse(await readFile(join(catalogue, 'manifest.json'), 'utf8'))
if (manifest.contract !== 'dpg:public-catalogue-snapshot:v1'
  || !/^[a-f0-9]{40}$/.test(manifest.checkpoint)
  || !Number.isSafeInteger(manifest.products) || manifest.products < 1
  || !Array.isArray(manifest.productBuckets)) throw new Error('PUBLIC_SITEMAP_MANIFEST_INVALID')

const paths = new Set(['/', '/lien-he', '/ve-chung-toi', '/blog'])
for (const category of manifest.categories ?? []) {
  paths.add(`/${category.slug}`)
  for (const listing of category.listings ?? []) paths.add(`/${category.slug}/${listing.slug}`)
}
const blog = JSON.parse(await readFile(resolve('apps/public/src/runtime/legacy-blog-snapshot.json'), 'utf8'))
const blogCategories = new Map(blog.categories.filter(category => category.is_active).map(category => [category.id, category.slug]))
for (const post of blog.posts) {
  const category = blogCategories.get(post.category_id)
  if (category && post.status === 'published' && post.published_at) {
    paths.add(`/blog/${category}`)
    paths.add(`/blog/${category}/${post.slug}`)
  }
}
let products = 0
const seenIds = new Set()
for (const bucket of manifest.productBuckets) {
  if (!/^[a-f0-9]{2}$/.test(bucket)) throw new Error('PUBLIC_SITEMAP_BUCKET_INVALID')
  const envelope = JSON.parse(await readFile(join(catalogue, 'products', `${bucket}.json`), 'utf8'))
  if (envelope.contract !== manifest.contract || envelope.checkpoint !== manifest.checkpoint
    || !Array.isArray(envelope.products)) throw new Error('PUBLIC_SITEMAP_BUCKET_INVALID')
  for (const product of envelope.products) {
    if (!Number.isSafeInteger(product.id) || seenIds.has(product.id)
      || typeof product.url !== 'string'
      || !/^\/(?:[a-z0-9]+-?)+\/(?:[a-z0-9]+-?)+\/(?:[a-z0-9]+-?)+$/.test(product.url)
      || paths.has(product.url)) throw new Error('PUBLIC_SITEMAP_PRODUCT_INVALID')
    seenIds.add(product.id)
    paths.add(product.url)
    products++
  }
}
if (products !== manifest.products) throw new Error('PUBLIC_SITEMAP_COUNT_MISMATCH')
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + [...paths].sort().map(path => `  <url><loc>${origin}${path}</loc></url>`).join('\n')
  + '\n</urlset>\n'
if (Buffer.byteLength(xml) > 2_000_000) throw new Error('PUBLIC_SITEMAP_CAPACITY')
await writeFile(join(root, 'sitemap.xml'), xml)
console.log(JSON.stringify({ status: 'PASS', stage: 'PUBLIC_SITEMAP', checkpoint: manifest.checkpoint, products, urls: paths.size }))
