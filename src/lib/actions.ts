'use server'

import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

// --- Auth ---
export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData)
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Sai email hoặc mật khẩu.'
                default:
                    return 'Đã xảy ra lỗi.'
            }
        }
        throw error
    }
}

// --- Products ---
const productSchema = z.object({
    name: z.string(),
    slug: z.string(),
    sku: z.string().optional(),
    price: z.coerce.number(),
    originalPrice: z.coerce.number().optional(),
    showPrice: z.boolean().default(false),
    categoryId: z.string(),
    brandId: z.string().optional(),
    productTypeId: z.string().optional(),
    collectionId: z.string().optional(),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    images: z.string().optional(),
    isPublished: z.boolean(),
    isFeatured: z.boolean().optional(),
    specs: z.string().optional(),
    // Tab: Thông tin sản phẩm
    material: z.string().optional(),
    thickness: z.string().optional(),
    waterAbsorption: z.string().optional(),
    usage: z.string().optional(),
    colorHex: z.string().optional(),
    // Tile-specific spec fields
    dimensions: z.string().optional(),
    simDimensions: z.string().optional(),
    surface: z.string().optional(),
    origin: z.string().optional(),
    antiSlip: z.string().optional(),
    patternCount: z.coerce.number().optional(),
    colorName: z.string().optional(),
})

export async function createProduct(data: any) {
    const validatedFields = productSchema.safeParse(data);
    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    // Determine redirect path based on category
    let redirectPath = '/admin/gach-op-lat'
    try {
        if (data.categoryId) {
            const cat = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { slug: true } })
            if (cat) redirectPath = `/admin/${cat.slug}`
        }
    } catch { }

    try {
        const d = validatedFields.data
        await prisma.product.create({
            data: {
                name: d.name,
                slug: d.slug,
                sku: d.sku || null,
                price: d.price,
                originalPrice: d.originalPrice || null,
                showPrice: d.showPrice,
                categoryId: d.categoryId,
                isPublished: d.isPublished,
                isFeatured: d.isFeatured || false,
                description: d.description || null,
                thumbnail: d.thumbnail || null,
                images: d.images || "",
                brandId: d.brandId || null,
                productTypeId: d.productTypeId || null,
                collectionId: d.collectionId || null,
                specs: d.specs || null,
                material: d.material || null,
                thickness: d.thickness || null,
                waterAbsorption: d.waterAbsorption || null,
                usage: d.usage || null,
                colorHex: d.colorHex || null,
                dimensions: d.dimensions || null,
                simDimensions: d.simDimensions || null,
                surface: d.surface || null,
                origin: d.origin || null,
                antiSlip: d.antiSlip || null,
                patternCount: d.patternCount || null,
                colorName: d.colorName || null,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo sản phẩm.' }
    }

    revalidatePath(redirectPath)
    redirect(redirectPath)
}

export async function updateProduct(id: string, data: any) {
    const validatedFields = productSchema.safeParse(data);
    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    // Determine redirect path based on category
    let redirectPath = '/admin/gach-op-lat'
    try {
        if (data.categoryId) {
            const cat = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { slug: true } })
            if (cat) redirectPath = `/admin/${cat.slug}`
        }
    } catch { }

    try {
        const d = validatedFields.data
        await prisma.product.update({
            where: { id },
            data: {
                name: d.name,
                slug: d.slug,
                sku: d.sku || null,
                price: d.price,
                originalPrice: d.originalPrice || null,
                showPrice: d.showPrice,
                categoryId: d.categoryId,
                isPublished: d.isPublished,
                isFeatured: d.isFeatured || false,
                description: d.description || null,
                thumbnail: d.thumbnail || null,
                images: d.images || "",
                brandId: d.brandId || null,
                productTypeId: d.productTypeId || null,
                collectionId: d.collectionId || null,
                specs: d.specs || null,
                material: d.material || null,
                thickness: d.thickness || null,
                waterAbsorption: d.waterAbsorption || null,
                usage: d.usage || null,
                colorHex: d.colorHex || null,
                dimensions: d.dimensions || null,
                simDimensions: d.simDimensions || null,
                surface: d.surface || null,
                origin: d.origin || null,
                antiSlip: d.antiSlip || null,
                patternCount: d.patternCount || null,
                colorName: d.colorName || null,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật sản phẩm.' }
    }

    revalidatePath(redirectPath)
    redirect(redirectPath)
}

export async function deleteProduct(id: string) {
    try {
        await prisma.product.delete({ where: { id } })
        revalidatePath('/admin/gach-op-lat')
        revalidatePath('/admin/products')
        return { message: 'Đã xóa sản phẩm.' }
    } catch (error) {
        return { message: 'Lỗi database khi xóa sản phẩm.' }
    }
}

// --- Collections ---
const collectionSchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    image: z.string().optional(),
    productTypeId: z.string(),
})

export async function createCollection(data: any) {
    const validated = collectionSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.collection.create({
            data: {
                name: validated.data.name,
                slug: validated.data.slug,
                image: validated.data.image || null,
                productTypeId: validated.data.productTypeId,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo bộ sưu tập.' }
    }

    revalidatePath('/admin/gach-op-lat')
    revalidatePath('/admin/collections')
    // Don't redirect — caller handles navigation (inline creation or collections page)
}

export async function updateCollection(id: string, data: any) {
    const validated = collectionSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.collection.update({
            where: { id },
            data: {
                name: validated.data.name,
                slug: validated.data.slug,
                image: validated.data.image || null,
                productTypeId: validated.data.productTypeId,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật bộ sưu tập.' }
    }

    revalidatePath('/admin/gach-op-lat')
    revalidatePath('/admin/collections')
    // Don't redirect — caller handles navigation
}

export async function deleteCollection(id: string) {
    try {
        // Unlink products from this collection first
        await prisma.product.updateMany({
            where: { collectionId: id },
            data: { collectionId: null },
        })
        await prisma.collection.delete({ where: { id } })
        revalidatePath('/admin/gach-op-lat')
        revalidatePath('/admin/collections')
        return { message: 'Đã xóa bộ sưu tập.' }
    } catch (error) {
        return { message: 'Lỗi database khi xóa bộ sưu tập.' }
    }
}

// --- Spec Suggestions (for dropdown fields) ---
export async function getSpecSuggestions(field: 'surface' | 'dimensions' | 'simDimensions' | 'origin' | 'antiSlip' | 'colorName') {
    try {
        const products = await prisma.product.findMany({
            where: {
                [field]: { not: null },
            },
            select: { [field]: true },
            distinct: [field],
            orderBy: { [field]: 'asc' },
        })
        return products.map((p: any) => p[field] as string).filter(Boolean)
    } catch {
        return []
    }
}

// --- Banners ---
const bannerSchema = z.object({
    title: z.string().min(1),
    image: z.string().min(1),
    link: z.string().optional(),
    order: z.coerce.number().default(0),
    isPublished: z.boolean().default(true),
})

export async function createBanner(data: any) {
    const validated = bannerSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.banner.create({
            data: {
                title: validated.data.title,
                image: validated.data.image,
                link: validated.data.link || null,
                order: validated.data.order,
                isPublished: validated.data.isPublished,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo banner.' }
    }

    revalidatePath('/admin/banners')
    redirect('/admin/banners')
}

export async function updateBanner(id: string, data: any) {
    const validated = bannerSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.banner.update({
            where: { id },
            data: {
                title: validated.data.title,
                image: validated.data.image,
                link: validated.data.link || null,
                order: validated.data.order,
                isPublished: validated.data.isPublished,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật banner.' }
    }

    revalidatePath('/admin/banners')
    redirect('/admin/banners')
}

export async function deleteBanner(id: string) {
    try {
        await prisma.banner.delete({ where: { id } })
        revalidatePath('/admin/banners')
        return { message: 'Đã xóa banner.' }
    } catch (error) {
        return { message: 'Lỗi database khi xóa banner.' }
    }
}

// --- Product Types (Sub-categories) ---
const productTypeSchema = z.object({
    name: z.string().min(1, "Tên loại sản phẩm là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    image: z.string().optional(),
    categoryId: z.string().min(1, "Danh mục bắt buộc"),
})

export async function createProductType(data: any) {
    const validated = productTypeSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.productType.create({
            data: {
                name: validated.data.name,
                slug: validated.data.slug,
                image: validated.data.image || null,
                categoryId: validated.data.categoryId,
            },
        })
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            return { message: 'Slug đã tồn tại. Vui lòng chọn slug khác.' }
        }
        return { message: 'Lỗi database khi tạo loại sản phẩm.' }
    }

    revalidatePath('/admin/gach-op-lat')
    return { success: true }
}

export async function updateProductType(id: string, data: any) {
    const validated = productTypeSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.productType.update({
            where: { id },
            data: {
                name: validated.data.name,
                slug: validated.data.slug,
                image: validated.data.image || null,
            },
        })
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            return { message: 'Slug đã tồn tại.' }
        }
        return { message: 'Lỗi database khi cập nhật loại sản phẩm.' }
    }

    revalidatePath('/admin/gach-op-lat')
    return { success: true }
}

export async function deleteProductType(id: string) {
    try {
        // Check if any products still assigned
        const productCount = await prisma.product.count({
            where: { productTypeId: id },
        })

        if (productCount > 0) {
            return {
                message: `Không thể xóa: còn ${productCount} sản phẩm thuộc loại này. Hãy chuyển hoặc xóa sản phẩm trước.`,
            }
        }

        // Also delete related collections
        await prisma.collection.deleteMany({ where: { productTypeId: id } })
        await prisma.productType.delete({ where: { id } })

        revalidatePath('/admin/gach-op-lat')
        return { success: true, message: 'Đã xóa loại sản phẩm.' }
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi xóa loại sản phẩm.' }
    }
}
