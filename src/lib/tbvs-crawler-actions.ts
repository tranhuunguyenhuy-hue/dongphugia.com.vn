'use server'

import prisma from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { downloadAndUploadImage, type CrawledProduct } from '@/lib/ai-crawler'

export async function getTbvsBrands() {
  try {
    const brands = await prisma.tbvs_brands.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    })
    return { success: true, data: brands }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getTbvsProductTypes() {
  try {
    const types = await prisma.tbvs_product_types.findMany({
      orderBy: { name: 'asc' },
    })
    return { success: true, data: types }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Find or create a product type by name
async function findOrCreateProductType(name: string): Promise<number> {
  if (!name) name = 'Khác'
  const slug = slugify(name)

  const existing = await prisma.tbvs_product_types.findUnique({ where: { slug } })
  if (existing) return existing.id

  const created = await prisma.tbvs_product_types.create({
    data: { name, slug, category_id: 2 }, // 2 = TBVS category
  })
  return created.id
}

// Find or create material
async function findOrCreateMaterial(name: string): Promise<number | null> {
  if (!name) return null
  const slug = slugify(name)

  const existing = await prisma.tbvs_materials.findUnique({ where: { slug } })
  if (existing) return existing.id

  const created = await prisma.tbvs_materials.create({
    data: { name, slug },
  })
  return created.id
}

// Find or create color (shared table)
async function findOrCreateColor(name: string): Promise<number | null> {
  if (!name) return null
  const slug = slugify(name)

  const existing = await prisma.colors.findUnique({ where: { slug } })
  if (existing) return existing.id

  const created = await prisma.colors.create({
    data: { name, slug },
  })
  return created.id
}

// Find or create origin (shared table)
async function findOrCreateOrigin(name: string): Promise<number | null> {
  if (!name) return null
  const slug = slugify(name)

  const existing = await prisma.origins.findUnique({ where: { slug } })
  if (existing) return existing.id

  const created = await prisma.origins.create({
    data: { name, slug },
  })
  return created.id
}

export async function importSingleTbvsProduct(
  product: CrawledProduct,
  brandId: number,
  uploadImages: boolean = true,
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Resolve relations
    const productTypeId = await findOrCreateProductType(product.productType || 'Khác')
    const materialId = await findOrCreateMaterial(product.material || '')
    const colorId = await findOrCreateColor(product.color || '')
    const originId = await findOrCreateOrigin(product.origin || '')

    // 2. Handle images
    let mainImageUrl = product.images[0] || ''
    const additionalImageUrls: string[] = []

    if (uploadImages && product.images.length > 0) {
      // Upload main image to Supabase
      const mainResult = await downloadAndUploadImage(product.images[0], 'tbvs')
      if (mainResult.success && mainResult.url) {
        mainImageUrl = mainResult.url
      }

      // Upload additional images (max 4)
      for (const imgUrl of product.images.slice(1, 5)) {
        const result = await downloadAndUploadImage(imgUrl, 'tbvs')
        if (result.success && result.url) {
          additionalImageUrls.push(result.url)
        }
      }
    }

    // 3. Build slug
    const baseSlug = slugify(product.name + '-' + product.sku)

    // 4. Parse warranty
    let warrantyMonths = 12
    if (product.warranty) {
      const yearMatch = product.warranty.match(/(\d+)\s*(năm|year)/i)
      const monthMatch = product.warranty.match(/(\d+)\s*(tháng|month)/i)
      if (yearMatch) warrantyMonths = parseInt(yearMatch[1]) * 12
      else if (monthMatch) warrantyMonths = parseInt(monthMatch[1])
    }

    // 5. Determine price display
    const priceDisplay = product.price || 'Liên hệ báo giá'

    // 6. UPSERT product
    const hasSpecs = product.specifications && Object.keys(product.specifications).length > 0

    const productData = {
      name: product.name,
      slug: baseSlug,
      product_type_id: productTypeId,
      brand_id: brandId,
      material_id: materialId,
      color_id: colorId,
      origin_id: originId,
      description: product.description || null,
      features: product.features || null,
      specifications: hasSpecs ? product.specifications : undefined,
      warranty_months: warrantyMonths,
      price_display: priceDisplay,
      image_main_url: mainImageUrl || null,
      is_active: true,
      is_new: true,
    }

    const upserted = await prisma.tbvs_products.upsert({
      where: { sku: product.sku },
      update: { ...productData, updated_at: new Date() },
      create: { sku: product.sku, ...productData },
    })

    // 7. Save additional images
    if (additionalImageUrls.length > 0) {
      await prisma.tbvs_product_images.deleteMany({ where: { product_id: upserted.id } })
      await prisma.tbvs_product_images.createMany({
        data: additionalImageUrls.map((url, idx) => ({
          product_id: upserted.id,
          image_url: url,
          sort_order: idx,
        })),
      })
    }

    revalidatePath('/admin/tbvs')
    return { success: true, message: `Imported: ${product.sku} — ${product.name}` }
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { success: false, message: `Duplicate: ${product.sku} — ${product.name}` }
    }
    return { success: false, message: `Error: ${error.message}` }
  }
}
