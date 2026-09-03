import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(
  path.join(root, 'supabase/migrations/20260903165000_owner_v1_pricing_contract.sql'),
  'utf8',
)
const adr = readFileSync(
  path.join(root, 'docs/adr/0020-v1-product-pricing-contract.md'),
  'utf8',
)

describe('Owner V1 pricing contract', () => {
  it('adds the three canonical Product pricing fields', () => {
    expect(migration).toContain('add column if not exists price numeric(15,2)')
    expect(migration).toContain('add column if not exists sale_price numeric(15,2)')
    expect(migration).toContain('add column if not exists voucher_online_discount_amount numeric(15,2)')
  })

  it('requires a lower sale price and bounded online discount', () => {
    expect(migration).toMatch(/sale_price\s*>\s*0\s*and\s*sale_price\s*<\s*price/)
    expect(migration).toMatch(/voucher_online_discount_amount\s*<\s*coalesce\(sale_price, price\)/)
  })

  it('moves publication authority to canonical price', () => {
    expect(migration).toMatch(/status\s*<>\s*'PUBLISHED'\s*or\s*\(price is not null and price > 0\)/)
    expect(migration).toContain("case when p.price is null or p.price <= 0 then 'PUBLIC_PRICE' end")
  })

  it('marks legacy pricing columns compatibility-only', () => {
    expect(migration).toContain('DEPRECATED_COMPATIBILITY_ONLY')
    expect(adr).toContain('retail_price')
    expect(adr).toContain('list_price')
  })

  it('does not define a generic voucher engine', () => {
    expect(adr).toContain('not** a generic voucher/coupon engine')
    expect(adr).toContain('voucher_online_discount_amount')
  })
})
