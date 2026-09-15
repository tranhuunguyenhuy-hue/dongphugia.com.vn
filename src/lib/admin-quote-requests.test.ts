import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    quote_requests: {
      findMany: mocks.findMany,
    },
  },
}))

import { getAdminQuoteRequests } from './admin-quote-requests'

describe('getAdminQuoteRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to the legacy quote_items schema when snapshot columns are absent', async () => {
    mocks.findMany
      .mockRejectedValueOnce({
        code: 'P2022',
        meta: { column: 'quote_items.product_name_snapshot' },
      })
      .mockResolvedValueOnce([
        {
          id: 1,
          quote_items: [{ products: { id: 10, name: 'Legacy product' } }],
        },
      ])

    const quotes = await getAdminQuoteRequests({ status: 'resolved' })

    expect(mocks.findMany).toHaveBeenCalledTimes(2)
    expect(mocks.findMany.mock.calls[0][0]).toEqual(expect.objectContaining({
      select: expect.objectContaining({
        quote_items: {
          select: {
            product_name_snapshot: true,
            products: { select: { id: true, name: true } },
          },
        },
      }),
    }))
    expect(mocks.findMany.mock.calls[1][0]).toEqual(expect.objectContaining({
      select: expect.objectContaining({
        quote_items: {
          select: {
            products: { select: { id: true, name: true } },
          },
        },
      }),
    }))
    expect(quotes[0].quote_items).toEqual([
      {
        product_name_snapshot: null,
        products: { id: 10, name: 'Legacy product' },
      },
    ])
  })

  it('does not hide unrelated database schema errors', async () => {
    const error = {
      code: 'P2022',
      meta: { column: 'quote_requests.unrelated_column' },
    }
    mocks.findMany.mockRejectedValueOnce(error)

    await expect(getAdminQuoteRequests({})).rejects.toBe(error)
    expect(mocks.findMany).toHaveBeenCalledTimes(1)
  })
})
