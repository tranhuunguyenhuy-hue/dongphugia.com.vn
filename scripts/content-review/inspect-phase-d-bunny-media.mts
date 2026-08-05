import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourcePath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-checkpoint-source.json')
const outputDir = path.join(root, 'scripts/content-review/private/leo-493-phase-d-media-inspection')

function safeExt(url: string): string {
    try {
        const ext = path.extname(new URL(url).pathname).toLowerCase()
        return /^\.(jpe?g|png|webp|gif|avif)$/.test(ext) ? ext : '.img'
    } catch {
        return '.img'
    }
}

function bunny(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase()
        return host === 'cdn.dongphugia.com.vn' || host.endsWith('.b-cdn.net')
    } catch {
        return false
    }
}

async function main() {
    const source = JSON.parse(await fs.readFile(sourcePath, 'utf8')) as { products: Array<{ id: number; sku: string; name: string; image_main_url: string | null; product_images: Array<{ id: number; image_url: string }> ; description: string | null }> }
    await fs.mkdir(outputDir, { recursive: true })
    let fetched = 0
    for (const product of source.products) {
        const entries: Array<{ key: string; url: string }> = []
        if (product.image_main_url && bunny(product.image_main_url)) entries.push({ key: 'main', url: product.image_main_url })
        for (const image of product.product_images) if (bunny(image.image_url)) entries.push({ key: `gallery-${image.id}`, url: image.image_url })
        const embedded = [...(product.description || '').matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)].map((match, index) => ({ key: `embedded-${index}`, url: match[2] }))
        for (const image of embedded) if (bunny(image.url)) entries.push(image)
        const productDir = path.join(outputDir, String(product.id))
        await fs.mkdir(productDir, { recursive: true })
        const index: Array<{ key: string; file: string; ok: boolean }> = []
        for (const entry of entries) {
            const file = `${entry.key}${safeExt(entry.url)}`
            const target = path.join(productDir, file)
            try {
                const response = await fetch(entry.url, { redirect: 'follow' })
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                await fs.writeFile(target, Buffer.from(await response.arrayBuffer()))
                index.push({ key: entry.key, file, ok: true })
                fetched += 1
            } catch {
                index.push({ key: entry.key, file, ok: false })
            }
        }
        await fs.writeFile(path.join(productDir, 'index.json'), `${JSON.stringify({ id: product.id, sku: product.sku, entries: index }, null, 2)}\n`, 'utf8')
    }
    console.log(`PHASE_D_BUNNY_INSPECTION_FETCHED=${fetched}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Bunny inspection failed'); process.exitCode = 1 })
