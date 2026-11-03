import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const output = resolve(process.argv[2] ?? '')
if (!process.argv[2]) throw new Error('PUBLIC_SNAPSHOT_OUTPUT_REQUIRED')
const lock = JSON.parse(await readFile(new URL('./public-snapshot-260-lock.json', import.meta.url), 'utf8'))
if (lock.contract !== 'dpg:public-snapshot-lock:v1' || lock.origin !== 'https://www.dongphugia.vn'
  || !/^[a-f0-9]{40}$/.test(lock.checkpoint)) throw new Error('PUBLIC_SNAPSHOT_LOCK_INVALID')

async function fetchAsset(path) {
  if (!/^(?:manifest\.json|products\/[a-f0-9]{2}\.json|listings\/[a-z0-9-]+\/[a-z0-9-]+\/[1-9][0-9]*\.json)$/.test(path)
    || !/^[a-f0-9]{64}$/.test(lock.assets[path] ?? '')) throw new Error('PUBLIC_SNAPSHOT_PATH_INVALID')
  const url = `${lock.origin}/__catalogue/v1/${path}`
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'error', headers: { 'User-Agent': 'DongPhuGia-Public-Snapshot-Recovery/1.0' }, signal: AbortSignal.timeout(30_000) })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('PUBLIC_SNAPSHOT_HTTP')
      const content = Buffer.from(await response.arrayBuffer())
      if (content.length > 2_000_000
        || createHash('sha256').update(content).digest('hex') !== lock.assets[path]) throw new Error('PUBLIC_SNAPSHOT_DIGEST')
      return content
    } catch (error) {
      if (attempt === 4) throw new Error(`PUBLIC_SNAPSHOT_FETCH_FAILED:${path}:${error.message}`)
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
}

const manifestBytes = await fetchAsset('manifest.json')
const manifest = JSON.parse(manifestBytes)
if (manifest.contract !== 'dpg:public-catalogue-snapshot:v1'
  || manifest.checkpoint !== lock.checkpoint || manifest.products !== lock.products
  || manifest.listingProducts !== lock.listingProducts) throw new Error('PUBLIC_SNAPSHOT_IDENTITY_MISMATCH')
const expected = ['manifest.json', ...manifest.productBuckets.map(bucket => `products/${bucket}.json`)]
for (const category of manifest.categories) for (const listing of category.listings) {
  for (let page = 1; page <= Math.ceil(listing.totalCount / 48); page++)
    expected.push(`listings/${category.slug}/${listing.slug}/${page}.json`)
}
if (expected.length !== Object.keys(lock.assets).length
  || new Set(expected).size !== expected.length
  || expected.some(path => !(path in lock.assets))) throw new Error('PUBLIC_SNAPSHOT_SET_MISMATCH')

const catalogue = join(output, '__catalogue/v1')
await mkdir(catalogue, { recursive: true })
await writeFile(join(catalogue, 'manifest.json'), manifestBytes, { flag: 'wx', mode: 0o600 })
let cursor = 1
const workers = Array.from({ length: 4 }, async () => {
  while (cursor < expected.length) {
    const path = expected[cursor++]
    const content = await fetchAsset(path)
    const destination = join(catalogue, path)
    await mkdir(resolve(destination, '..'), { recursive: true })
    await writeFile(destination, content, { flag: 'wx', mode: 0o600 })
  }
})
await Promise.all(workers)
console.log(JSON.stringify({ status: 'PASS', stage: 'LOCKED_PUBLIC_SNAPSHOT', checkpoint: lock.checkpoint,
  assets: expected.length, products: lock.products, listingProducts: lock.listingProducts }))
