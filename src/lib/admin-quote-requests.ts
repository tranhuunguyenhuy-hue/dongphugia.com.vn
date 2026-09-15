import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

const quoteRequestFields = {
  id: true,
  name: true,
  phone: true,
  email: true,
  message: true,
  created_at: true,
  status: true,
  assigned_to: true,
} as const

const productSelect = {
  id: true,
  name: true,
} as const

const isMissingQuoteSnapshotColumn = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2022') {
    return false
  }

  const meta = 'meta' in error && error.meta && typeof error.meta === 'object'
    ? error.meta
    : null
  const column = meta && 'column' in meta ? meta.column : null

  return typeof column === 'string'
    && (column === 'product_name_snapshot' || column.endsWith('.product_name_snapshot'))
}

export async function getAdminQuoteRequests(where: Prisma.quote_requestsWhereInput) {
  try {
    return await prisma.quote_requests.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        ...quoteRequestFields,
        quote_items: {
          select: {
            product_name_snapshot: true,
            products: { select: productSelect },
          },
        },
      },
    })
  } catch (error) {
    if (!isMissingQuoteSnapshotColumn(error)) throw error

    const legacyQuotes = await prisma.quote_requests.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        ...quoteRequestFields,
        quote_items: {
          select: {
            products: { select: productSelect },
          },
        },
      },
    })

    return legacyQuotes.map(quote => ({
      ...quote,
      quote_items: quote.quote_items.map(item => ({
        ...item,
        product_name_snapshot: null,
      })),
    }))
  }
}
