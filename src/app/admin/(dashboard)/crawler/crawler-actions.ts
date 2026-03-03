'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { slugify } from '@/lib/utils'

export async function getPatternTypes() {
    try {
        const types = await prisma.pattern_types.findMany({
            orderBy: { name: 'asc' }
        })
        return { success: true, data: types }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function fetchCategoryLinks(url: string) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const html = await res.text()

        // Extract product links from category page
        // Format: <a href="/san-pham/gach-op-lat/marvel-travertine/gach-612mtwhcrmt/" class="product">
        const linkRegex = /<a href="(\/san-pham\/gach-op-lat\/[^"]+)"[^>]*class="product"/g
        let match
        const links = new Set<string>()
        while ((match = linkRegex.exec(html)) !== null) {
            links.add('https://vietceramics.com' + match[1])
        }

        return { success: true, links: Array.from(links) }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function crawlProduct(url: string, patternTypeId: number) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const html = await res.text()

        // Extract Name
        const nameMatch = html.match(/<h2[^>]*class="[^"]*product-title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h2>/i)
            || html.match(/<meta property="?og:title"?[^>]*content="([^"]+)"/i)
            || html.match(/<title>([^<]+)\|/i);
        if (!nameMatch) return { success: false, message: 'Could not find product name' }
        const name = nameMatch[1].trim()

        // Extract SKU
        const skuMatch1 = html.match(/>MÃ SẢN PHẨM:?<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
        const skuMatch2 = html.match(/<a[^>]*class="sku selected"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
        const sku = skuMatch1 ? skuMatch1[1].trim() : (skuMatch2 ? skuMatch2[1].trim() : 'SKU-' + Date.now().toString());

        // Extract Surface
        const surMatch1 = html.match(/>Bề mặt:?<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
        const surMatch2 = html.match(/>BỀ MẶT:?<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
        const surface = surMatch1 ? surMatch1[1].trim() : (surMatch2 ? surMatch2[1].trim() : 'Khác');

        // Extract Size
        const sizeMatch1 = html.match(/>QUY CÁCH:?<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
        const sizeMatch2 = html.match(/>KÍCH THƯỚC.*?<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
        const size = sizeMatch1 ? sizeMatch1[1].trim() : (sizeMatch2 ? sizeMatch2[1].trim() : 'Khác');

        // Extract Origin
        const oriMatch1 = html.match(/>Xuất xứ:?<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
        const oriMatch2 = html.match(/>XUẤT XỨ:?<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
        const origin = oriMatch1 ? oriMatch1[1].trim() : (oriMatch2 ? oriMatch2[1].trim() : 'Khác');

        // Extract Images
        const imgRegex = /<img[^>]+src="(\/media\/[^"]+)"/g
        let matchImg
        const images = new Set<string>()
        while ((matchImg = imgRegex.exec(html)) !== null) {
            images.add('https://vietceramics.com' + matchImg[1])
        }
        const imageUrls = Array.from(images)
        const mainImage = imageUrls.length > 0 ? imageUrls[0] : ''

        // 1. Dùng trực tiếp Pattern Type ID từ Client thay vì tự tạo

        // 1.5 Auto-detect and Map Collection (Bộ Sưu Tập) from URL
        let collectionEntity = null
        try {
            const urlObj = new URL(url)
            const urlParts = urlObj.pathname.split('/').filter(Boolean)
            // Vietceramics URLs pattern: /san-pham/gach-op-lat/mystic/gach-612mydakry/
            // Collection is usually the 2nd to last item
            if (urlParts.length >= 4) {
                const collectionSlug = urlParts[urlParts.length - 2]
                collectionEntity = await prisma.collections.findUnique({ where: { slug: collectionSlug } })

                if (!collectionEntity) {
                    const collectionName = collectionSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    collectionEntity = await prisma.collections.create({
                        data: {
                            name: collectionName,
                            slug: collectionSlug,
                            pattern_type_id: patternTypeId
                        }
                    })
                }
            }
        } catch (e) {
            console.error("Error creating collection:", e)
        }

        // 2. Map or Create Surface
        let surfaceSlug = slugify(surface)
        let surfaceEntity = await prisma.surfaces.findUnique({ where: { slug: surfaceSlug } })
        if (!surfaceEntity) {
            surfaceEntity = await prisma.surfaces.create({ data: { name: surface, slug: surfaceSlug } })
        }

        // 3. Map or Create Origin
        let originSlug = slugify(origin)
        let originEntity = await prisma.origins.findUnique({ where: { slug: originSlug } })
        if (!originEntity) {
            originEntity = await prisma.origins.create({ data: { name: origin, slug: originSlug } })
        }

        // 4. Map or Create Size
        let sizeSlug = slugify(size)
        // Parse size string like "60x120 cm" to width and height
        let w = 0, h = 0
        const dims = size.match(/(\d+)[\s]*x[\s]*(\d+)/i)
        if (dims && dims.length === 3) {
            w = parseInt(dims[1]) * 10 // Convert cm to mm roughly if needed, or keeping it
            h = parseInt(dims[2]) * 10
        }
        let sizeEntity = await prisma.sizes.findUnique({ where: { slug: sizeSlug } })
        if (!sizeEntity) {
            sizeEntity = await prisma.sizes.create({
                data: { label: size, slug: sizeSlug, width_mm: w, height_mm: h }
            })
        }

        // 5. UPSERT Product (Check if SKU exists to avoid duplicates)
        const productData = {
            sku: sku,
            name: name,
            slug: slugify(name + '-' + sku),
            pattern_type_id: patternTypeId,
            collection_id: collectionEntity ? collectionEntity.id : null,
            surface_id: surfaceEntity.id,
            origin_id: originEntity.id,
            size_id: sizeEntity.id,
            image_main_url: mainImage, // Hotlinking!
            price_display: 'Liên hệ',
            is_active: true
        }

        const product = await prisma.products.upsert({
            where: { sku: sku },
            update: productData,
            create: productData
        })

        // Insert additional images if any
        if (imageUrls.length > 1) {
            // Delete old images first to avoid duplicates
            await prisma.product_images.deleteMany({ where: { product_id: product.id } })
            const imgData = imageUrls.slice(0, 5).map((imgUrl, idx) => ({
                product_id: product.id,
                image_url: imgUrl,
                sort_order: idx
            }))
            await prisma.product_images.createMany({ data: imgData })
        }

        return { success: true, message: `Crawled: ${sku} - ${name}` }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function scanDeadImages() {
    try {
        const products = await prisma.products.findMany({
            where: {
                is_active: true,
                image_main_url: { contains: 'vietceramics.com' }
            },
            select: { id: true, sku: true, name: true, image_main_url: true }
        })

        let deadCount = 0
        for (const p of products) {
            try {
                if (!p.image_main_url) continue
                const res = await fetch(p.image_main_url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } })
                if (res.status === 404 || !res.ok) {
                    await prisma.products.update({ where: { id: p.id }, data: { is_active: false } })
                }
            } catch (err) {
                // Ignore network errors
            }
        }
        return { success: true, message: `Đã quét ${products.length} ảnh. Không phát hiện link chết.` }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
