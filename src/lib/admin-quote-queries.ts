'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type QuoteStatus = 'pending' | 'reviewing' | 'quoted' | 'accepted' | 'rejected' | 'cancelled'

export interface AdminQuotesParams {
  search?: string
  status?: QuoteStatus
  page?: number
  pageSize?: number
  orderBy?: 'created_at' | 'updated_at'
  orderDir?: 'asc' | 'desc'
}

// ─── GET ADMIN QUOTES (list + filter + search + paginate) ────────────────────

/**
 * Primary query for the /quotes admin listing page.
 * Supports filter by status, search by name/phone/quote_number.
 */
export async function getAdminQuotes(params: AdminQuotesParams = {}) {
  const {
    search,
    status,
    page = 1,
    pageSize = 25,
    orderBy = 'created_at',
    orderDir = 'desc',
  } = params

  const where: Prisma.quote_requestsWhereInput = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { quote_number: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [quotes, total] = await Promise.all([
    prisma.quote_requests.findMany({
      where,
      orderBy: { [orderBy]: orderDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        quote_number: true,
        name: true,
        phone: true,
        email: true,
        message: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: { select: { quote_items: true } },
        // Preview: first 3 items for list view
        quote_items: {
          take: 3,
          select: {
            id: true,
            quantity: true,
            note: true,
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                image_main_url: true,
                price_display: true,
              },
            },
          },
        },
      },
    }),
    prisma.quote_requests.count({ where }),
  ])

  return {
    quotes,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ─── GET ADMIN QUOTE BY ID (full detail page) ─────────────────────────────────

/**
 * Full quote detail for the /quotes/[id] admin page.
 * Includes all items with product thumbnails, price info, and notes.
 */
export async function getAdminQuoteById(id: number) {
  return prisma.quote_requests.findUnique({
    where: { id },
    include: {
      quote_items: {
        include: {
          products: {
            select: {
              id: true,
              name: true,
              sku: true,
              image_main_url: true,
              price: true,
              price_display: true,
              stock_status: true,
              categories: { select: { name: true, slug: true } },
              subcategories: { select: { name: true } },
              brands: { select: { name: true } },
            },
          },
        },
      },
    },
  })
}

// ─── QUOTE STATS (for dashboard action items) ─────────────────────────────────

/**
 * Returns counts by status — used by Dashboard Action Items section.
 */
export async function getQuoteStats() {
  const [total, pending, reviewing, quoted] = await Promise.all([
    prisma.quote_requests.count(),
    prisma.quote_requests.count({ where: { status: 'pending' } }),
    prisma.quote_requests.count({ where: { status: 'reviewing' } }),
    prisma.quote_requests.count({ where: { status: 'quoted' } }),
  ])

  return { total, pending, reviewing, quoted }
}
