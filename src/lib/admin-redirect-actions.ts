'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface AdminRedirectsParams {
  search?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

const redirectSchema = z.object({
  old_url: z.string().min(1, 'URL cũ là bắt buộc').max(500).startsWith('/', { message: 'URL phải bắt đầu bằng /' }),
  new_url: z.string().min(1, 'URL mới là bắt buộc').max(500),
  status_code: z.coerce.number().int().refine(n => [301, 302, 307, 308].includes(n), {
    message: 'Chỉ chấp nhận status code: 301, 302, 307, 308',
  }).default(301),
  is_active: z.boolean().default(true),
})

// ─── GET REDIRECTS (list + filter + paginate) ─────────────────────────────────

/**
 * Primary query for the /seo admin page (Redirects tab).
 * Supports search by old_url or new_url, filter by is_active.
 */
export async function getAdminRedirects(params: AdminRedirectsParams = {}) {
  const { search, isActive, page = 1, pageSize = 25 } = params

  const where: Prisma.redirectsWhereInput = {
    ...(isActive !== undefined && { is_active: isActive }),
    ...(search && {
      OR: [
        { old_url: { contains: search, mode: 'insensitive' as const } },
        { new_url: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [redirects, total] = await Promise.all([
    prisma.redirects.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.redirects.count({ where }),
  ])

  return {
    redirects,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ─── CREATE REDIRECT ──────────────────────────────────────────────────────────

export async function createRedirect(data: unknown) {
  const validated = redirectSchema.safeParse(data)
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  const d = validated.data

  try {
    const redirect = await prisma.redirects.create({
      data: {
        old_url: d.old_url,
        new_url: d.new_url,
        status_code: d.status_code,
        is_active: d.is_active,
      },
    })
    // Note: In the new admin CMS, this will also call syncMainSite(['/'])
    revalidatePath('/seo')
    return { success: true, id: redirect.id }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'P2002') return { message: 'URL cũ này đã có redirect rồi' }
    return { message: 'Lỗi tạo redirect: ' + (e.message ?? 'Unknown error') }
  }
}

// ─── UPDATE REDIRECT ──────────────────────────────────────────────────────────

export async function updateRedirect(id: number, data: unknown) {
  const validated = redirectSchema.safeParse(data)
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  const d = validated.data

  try {
    await prisma.redirects.update({
      where: { id },
      data: {
        old_url: d.old_url,
        new_url: d.new_url,
        status_code: d.status_code,
        is_active: d.is_active,
      },
    })
    revalidatePath('/seo')
    return { success: true }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'P2002') return { message: 'URL cũ này đã có redirect rồi' }
    return { message: 'Lỗi cập nhật redirect: ' + (e.message ?? 'Unknown error') }
  }
}

// ─── DELETE REDIRECT ──────────────────────────────────────────────────────────

export async function deleteRedirect(id: number) {
  try {
    await prisma.redirects.delete({ where: { id } })
    revalidatePath('/seo')
    return { success: true }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { message: 'Lỗi xóa redirect: ' + (e.message ?? 'Unknown error') }
  }
}

// ─── TOGGLE REDIRECT ACTIVE ───────────────────────────────────────────────────

export async function toggleRedirectActive(id: number, isActive: boolean) {
  try {
    await prisma.redirects.update({
      where: { id },
      data: { is_active: isActive },
    })
    revalidatePath('/seo')
    return { success: true }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { message: 'Lỗi cập nhật redirect: ' + (e.message ?? 'Unknown error') }
  }
}

// ─── BULK DELETE REDIRECTS ────────────────────────────────────────────────────

export async function bulkDeleteRedirects(ids: number[]) {
  try {
    const result = await prisma.redirects.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/seo')
    return { success: true, count: result.count }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { message: 'Lỗi xóa redirects: ' + (e.message ?? 'Unknown error') }
  }
}

// ─── REDIRECT STATS ───────────────────────────────────────────────────────────

export async function getRedirectStats() {
  const [total, active] = await Promise.all([
    prisma.redirects.count(),
    prisma.redirects.count({ where: { is_active: true } }),
  ])
  return { total, active, inactive: total - active }
}
