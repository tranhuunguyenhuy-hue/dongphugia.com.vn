import { expect, it } from 'vitest'
import { restoredPublicPricing, isRestoredPublicPricing } from './public-restored-pricing.mjs'

const source = {
  price: '21223200.00', original_price: '26529000.00', list_price: '26529000.00',
  sale_price: '21223200.00', online_discount_amount: '3183000.00',
  price_source: 'hita', source_system: 'hita', price_state: 'priced',
  price_confidence: 'high', price_updated_at: new Date('2026-07-02T00:00:00Z'),
}

it('restores the exact historical SKU price and final online amount', () => {
  const value = restoredPublicPricing(source)
  expect(value).toMatchObject({ price: 21223200, original_price: 26529000,
    sale_price: 21223200, online_discount_amount: 3183000, final_online_price: 18040200,
    price_provenance: 'legacy-hita-pm-approved-2026-11-03' })
  expect(isRestoredPublicPricing(value)).toBe(true)
})

it('publishes the old Hita price even when optional comparisons are missing or conflict',()=>{
 for(const change of [{original_price:null,list_price:null},{sale_price:'21223201'},{original_price:'26529001'},
   {online_discount_amount:'21223200'}]){
  const value=restoredPublicPricing({...source,...change})
  expect(value.price).toBe(21223200)
  if(change.original_price===null||change.original_price==='26529001')expect(value.original_price).toBeNull()
  if(change.online_discount_amount)expect(value.final_online_price).toBeNull()
  expect(isRestoredPublicPricing(value)).toBe(true)
 }
})
it('keeps an absent online discount absent and quarantines invalid source identity or manual mapping', () => {
  const manual = restoredPublicPricing({ ...source, price_source: 'manual', source_system: 'manual', online_discount_amount: null })
  expect(manual.final_online_price).toBeNull()
  expect(isRestoredPublicPricing(manual)).toBe(true)
  for (const change of [{ sale_price: '21223201',price_source:'manual',source_system:'manual' },
    { original_price: '26529001',price_source:'manual',source_system:'manual' },
    { price_source: 'unknown' },
    { price_updated_at: new Date('2026-07-03') }]) {
    const value = restoredPublicPricing({ ...source, ...change })
    expect(value.price).toBeNull()
    expect(isRestoredPublicPricing(value)).toBe(true)
  }
})
