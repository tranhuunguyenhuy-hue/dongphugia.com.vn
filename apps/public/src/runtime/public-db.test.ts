import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}))

vi.mock('cloudflare:workers', () => ({
  env: { PUBLIC_DB: { connectionString: 'postgresql://readonly.invalid/test' } },
}))
vi.mock('pg', () => ({
  Client: class MockClient {
    constructor() {
      return { connect: mocks.connect, query: mocks.query, end: mocks.end }
    }
  },
}))

import { readPublicRows } from './public-db'

describe('Public PostgreSQL read boundary', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_CATALOGUE_SOURCE', 'postgresql')
    mocks.connect.mockReset().mockResolvedValue(undefined)
    mocks.query.mockReset().mockResolvedValue({ rows: [{ id: 7 }] })
    mocks.end.mockReset().mockResolvedValue(undefined)
  })

  it('uses a bound SELECT through the Hyperdrive client and closes it', async () => {
    await expect(readPublicRows<{ id: number }>('SELECT id FROM dpg_app.products WHERE sku = $1', ['DPG-7']))
      .resolves.toEqual([{ id: 7 }])
    expect(mocks.query).toHaveBeenCalledWith('SELECT id FROM dpg_app.products WHERE sku = $1', ['DPG-7'])
    expect(mocks.end).toHaveBeenCalledOnce()
  })

  it.each([
    'UPDATE dpg_app.products SET name = $1',
    'SELECT id FROM dpg_app.products; DELETE FROM dpg_app.products',
    'WITH changed AS (DELETE FROM dpg_app.products RETURNING id) SELECT id FROM changed',
  ])('rejects non-read-only SQL before connecting: %s', async (statement) => {
    await expect(readPublicRows(statement)).rejects.toThrow('PUBLIC_DATABASE_READ_ONLY_REQUIRED')
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it('keeps database reads disabled when Production selects the snapshot source', async () => {
    vi.stubEnv('PUBLIC_CATALOGUE_SOURCE', 'snapshot')
    await expect(readPublicRows('SELECT id FROM dpg_app.products')).rejects.toThrow('PUBLIC_DATABASE_MODE_DISABLED')
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it('logs bounded query labels and concurrent read-client counts only in the diagnostic Worker', async () => {
    vi.stubEnv('PUBLIC_CATALOGUE_SOURCE', 'postgresql')
    vi.stubEnv('PUBLIC_DB_DIAGNOSTICS', 'true')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await readPublicRows('SELECT id FROM dpg_app.products WHERE sku = $1', ['private-sku'])

    const record = JSON.parse(String(log.mock.calls[0][0]))
    expect(record).toMatchObject({
      event: 'PUBLIC_DATABASE_READ_OK', queryTables: ['products'],
      activePgClients: 1,
    })
    expect(JSON.stringify(record)).not.toContain('private-sku')
    expect(JSON.stringify(record)).not.toContain('postgresql://readonly.invalid')
    log.mockRestore()
  })
})
