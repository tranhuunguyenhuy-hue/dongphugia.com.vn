'use server'

import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
// fix missing images type mismatch
import { Prisma } from "@prisma/client"

const productSchema = z.object({
    name: z.string(),
    slug: z.string(),
    price: z.coerce.number(),
    categoryId: z.string(),
    brandId: z.string().optional(),
    productTypeId: z.string().optional(),
    description: z.string().optional(),
    images: z.string().optional(),
    isPublished: z.boolean(),
})

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
                    return 'Invalid credentials.'
                default:
                    return 'Something went wrong.'
            }
        }
        throw error
    }
}

export async function createProduct(data: any) {
    const validatedFields = productSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    try {
        await prisma.product.create({
            data: {
                name: validatedFields.data.name,
                slug: validatedFields.data.slug,
                price: validatedFields.data.price,
                categoryId: validatedFields.data.categoryId,
                isPublished: validatedFields.data.isPublished,
                description: validatedFields.data.description,
                images: (validatedFields.data.images || "[]") as any, // Default to empty JSON array
                // Handle optional fields explicitly
                brandId: validatedFields.data.brandId || null,
                productTypeId: validatedFields.data.productTypeId || null,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return {
            message: 'Database Error: Failed to Create Product.',
        }
    }

    revalidatePath('/admin/products')
    redirect('/admin/products')
}

export async function updateProduct(id: string, data: any) {
    const validatedFields = productSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    try {
        await prisma.product.update({
            where: { id },
            data: {
                name: validatedFields.data.name,
                slug: validatedFields.data.slug,
                price: validatedFields.data.price,
                categoryId: validatedFields.data.categoryId,
                isPublished: validatedFields.data.isPublished,
                description: validatedFields.data.description,
                images: (validatedFields.data.images || "[]") as any,
                brandId: validatedFields.data.brandId || null,
                productTypeId: validatedFields.data.productTypeId || null,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return {
            message: 'Database Error: Failed to Update Product.',
        }
    }

    revalidatePath('/admin/products')
    redirect('/admin/products')
}

export async function deleteProduct(id: string) {
    try {
        await prisma.product.delete({
            where: { id },
        })
        revalidatePath('/admin/products')
        return { message: 'Deleted Product.' }
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Product.' }
    }
}
