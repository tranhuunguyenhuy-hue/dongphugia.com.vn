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
    redirect('/admin/collections')
}

export async function deleteCollection(id: string) {
    try {
        await prisma.collection.delete({ where: { id } })
        revalidatePath('/admin/gach-op-lat')
        revalidatePath('/admin/collections')
        return { message: 'Đã xóa bộ sưu tập.' }
    } catch (error) {
        return { message: 'Lỗi database khi xóa bộ sưu tập.' }
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
