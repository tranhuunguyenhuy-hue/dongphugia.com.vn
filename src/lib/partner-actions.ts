'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { slugify } from '@/lib/utils'

const PartnerSchema = z.object({
    name: z.string().min(1, 'Tên không được để trống'),
    logo_url: z.string().optional(),
    description: z.string().optional(),
    tier: z.string().optional(),
    gradient_class: z.string().optional(),
    link_url: z.string().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().optional(),
})

export async function createPartner(data: z.infer<typeof PartnerSchema>) {
    const parsed = PartnerSchema.safeParse(data)
    if (!parsed.success) {
        return { errors: parsed.error.flatten().fieldErrors, message: 'Dữ liệu không hợp lệ' }
    }
    const slug = slugify(parsed.data.name) + '-' + Date.now()
    await prisma.partners.create({
        data: {
            name: parsed.data.name,
            slug,
            logo_url: parsed.data.logo_url ?? null,
            description: parsed.data.description ?? null,
            tier: parsed.data.tier ?? 'Vàng',
            gradient_class: parsed.data.gradient_class ?? null,
            link_url: parsed.data.link_url ?? null,
            is_active: parsed.data.is_active ?? true,
            sort_order: parsed.data.sort_order ?? 0,
        },
    })
    revalidatePath('/admin/doi-tac')
    revalidatePath('/doi-tac')
    revalidatePath('/')
    return { success: true }
}

export async function updatePartner(id: number, data: z.infer<typeof PartnerSchema>) {
    const parsed = PartnerSchema.safeParse(data)
    if (!parsed.success) {
        return { errors: parsed.error.flatten().fieldErrors, message: 'Dữ liệu không hợp lệ' }
    }
    await prisma.partners.update({
        where: { id },
        data: {
            name: parsed.data.name,
            logo_url: parsed.data.logo_url ?? null,
            description: parsed.data.description ?? null,
            tier: parsed.data.tier ?? 'Vàng',
            gradient_class: parsed.data.gradient_class ?? null,
            link_url: parsed.data.link_url ?? null,
            is_active: parsed.data.is_active ?? true,
            sort_order: parsed.data.sort_order ?? 0,
            updated_at: new Date(),
        },
    })
    revalidatePath('/admin/doi-tac')
    revalidatePath('/doi-tac')
    revalidatePath('/')
    return { success: true }
}

export async function deletePartner(id: number) {
    await prisma.partners.delete({ where: { id } })
    revalidatePath('/admin/doi-tac')
    revalidatePath('/doi-tac')
    revalidatePath('/')
    return { success: true }
}
