'use server'

import prisma from '@/lib/prisma'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type RevenuePeriod = 'day' | 'week' | 'month' | 'year'

export interface RevenueDataPoint {
  date: string
  revenue: number
  orderCount: number
}

// ─── DASHBOARD OVERVIEW STATS ─────────────────────────────────────────────────

/**
 * Fetches all top-level KPI numbers for the Dashboard header cards.
 * Single query: pending quotes, pending orders, total revenue this month, active products.
 */
export async function getDashboardStats() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  const [
    pendingQuotes,
    pendingOrders,
    revenueThisMonth,
    revenueLastMonth,
    totalProducts,
    activeProducts,
  ] = await Promise.all([
    // Quotes waiting for response
    prisma.quote_requests.count({ where: { status: 'pending' } }),

    // Orders waiting for confirmation
    prisma.orders.count({ where: { status: 'pending' } }),

    // Revenue this month (confirmed paid + delivered)
    prisma.orders.aggregate({
      _sum: { total: true },
      _count: true,
      where: {
        status: 'delivered',
        payment_status: 'paid',
        created_at: { gte: startOfMonth },
      },
    }),

    // Revenue last month (for comparison %)
    prisma.orders.aggregate({
      _sum: { total: true },
      where: {
        status: 'delivered',
        payment_status: 'paid',
        created_at: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),

    // Total products
    prisma.products.count(),

    // Active products
    prisma.products.count({ where: { is_active: true } }),
  ])

  const revenueThisMonthNum = Number(revenueThisMonth._sum.total || 0)
  const revenueLastMonthNum = Number(revenueLastMonth._sum.total || 0)

  // Revenue growth %
  const revenueGrowth = revenueLastMonthNum === 0
    ? null
    : Math.round(((revenueThisMonthNum - revenueLastMonthNum) / revenueLastMonthNum) * 100)

  return {
    pendingQuotes,
    pendingOrders,
    revenueThisMonth: revenueThisMonthNum,
    revenueLastMonth: revenueLastMonthNum,
    revenueGrowth,
    ordersThisMonth: revenueThisMonth._count,
    totalProducts,
    activeProducts,
  }
}

// ─── REVENUE CHART DATA ───────────────────────────────────────────────────────

/**
 * Returns time-series revenue data for the dashboard Area chart.
 * Aggregates by period: day (30d), week (12w), month (12mo), year (5y).
 *
 * NOTE: Uses raw SQL for date truncation — Prisma ORM doesn't support
 * DATE_TRUNC natively. Safe: no user input is used in the query.
 */
export async function getRevenueChart(period: RevenuePeriod = 'month'): Promise<RevenueDataPoint[]> {
  let truncUnit: string
  let intervalDays: number

  switch (period) {
    case 'day':
      truncUnit = 'day'
      intervalDays = 30
      break
    case 'week':
      truncUnit = 'week'
      intervalDays = 84 // 12 weeks
      break
    case 'month':
      truncUnit = 'month'
      intervalDays = 365 // 12 months
      break
    case 'year':
      truncUnit = 'year'
      intervalDays = 365 * 5 // 5 years
      break
  }

  const rows = await prisma.$queryRawUnsafe<
    { date: Date; revenue: bigint; order_count: bigint }[]
  >(`
    SELECT
      DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS date,
      SUM(total) AS revenue,
      COUNT(*) AS order_count
    FROM orders
    WHERE
      status = 'delivered'
      AND payment_status = 'paid'
      AND created_at >= NOW() - INTERVAL '${intervalDays} days'
    GROUP BY DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
    ORDER BY date ASC
  `)

  return rows.map(row => ({
    date: row.date.toISOString(),
    revenue: Number(row.revenue),
    orderCount: Number(row.order_count),
  }))
}

// ─── ACTION ITEMS — PENDING QUOTES ────────────────────────────────────────────

/**
 * Returns the 5 most recent pending quotes for the Dashboard Action Items card.
 */
export async function getPendingQuotes() {
  const quotes = await prisma.quote_requests.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      quote_number: true,
      name: true,
      phone: true,
      created_at: true,
      status: true,
      quote_items: {
        select: {
          quantity: true,
          products: {
            select: {
              name: true
            }
          }
        }
      }
    },
  })
  return quotes
}

// ─── ACTION ITEMS — PENDING ORDERS ────────────────────────────────────────────

/**
 * Returns the 5 most recent pending orders for the Dashboard Action Items card.
 */
export async function getPendingOrders() {
  const orders = await prisma.orders.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      order_number: true,
      customer_name: true,
      customer_phone: true,
      total: true,
      payment_status: true,
      status: true,
      created_at: true,
      order_items: {
        select: {
          product_name: true,
          quantity: true
        }
      }
    },
  })
  return orders.map(o => ({ ...o, total: Number(o.total) }))
}

// ─── TOP PRODUCTS BY SALES ────────────────────────────────────────────────────

/**
 * Returns top-selling products by quantity (from delivered orders).
 * Used by the "SP bán chạy" card on the Dashboard.
 */
export async function getTopProductsBySales(limit = 5) {
  const rows = await prisma.$queryRawUnsafe<
    {
      product_id: number
      product_name: string
      product_sku: string
      total_sold: bigint
      image_url: string | null
    }[]
  >(`
    SELECT
      oi.product_id,
      oi.product_name,
      oi.product_sku,
      SUM(oi.quantity) AS total_sold,
      p.image_main_url AS image_url
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.status = 'delivered'
    GROUP BY oi.product_id, oi.product_name, oi.product_sku, p.image_main_url
    ORDER BY total_sold DESC
    LIMIT ${limit}
  `)

  return rows.map(row => ({
    productId: Number(row.product_id),
    productName: row.product_name,
    productSku: row.product_sku,
    totalSold: Number(row.total_sold),
    imageUrl: row.image_url,
  }))
}

// ─── TOP PRODUCTS BY QUOTE FREQUENCY ─────────────────────────────────────────

/**
 * Returns most frequently quoted products.
 * Used as fallback "hot products" metric when sales data is sparse.
 */
export async function getTopProductsByQuotes(limit = 5) {
  const rows = await prisma.$queryRawUnsafe<
    {
      product_id: number
      name: string
      sku: string
      quote_count: bigint
      image_url: string | null
    }[]
  >(`
    SELECT
      qi.product_id,
      p.name,
      p.sku,
      COUNT(qi.id) AS quote_count,
      p.image_main_url AS image_url
    FROM quote_items qi
    JOIN products p ON qi.product_id = p.id
    GROUP BY qi.product_id, p.name, p.sku, p.image_main_url
    ORDER BY quote_count DESC
    LIMIT ${limit}
  `)

  return rows.map(row => ({
    productId: Number(row.product_id),
    name: row.name,
    sku: row.sku,
    quoteCount: Number(row.quote_count),
    imageUrl: row.image_url,
  }))
}
