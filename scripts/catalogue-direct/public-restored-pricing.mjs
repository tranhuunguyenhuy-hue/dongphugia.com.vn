// 2026-11-03 PM decision for the Public recovery: retain verified historical
// Hita-tagged selling prices as well as manual prices. This is a frozen import
// policy, not a rule for future catalogue or manufacturer pricing.
const MAX_VND = 1_000_000_000
const money = value => {
  if (value === null || value === undefined || value === '') return null
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_VND ? amount : null
}

export function restoredPublicPricing(input) {
  const contact = {
    price: null, original_price: null, list_price: null, sale_price: null,
    online_discount_amount: null, final_online_price: null,
    price_display: 'Liên hệ báo giá', is_promotion: false, price_provenance: null,
  }
  const date = input.price_updated_at instanceof Date
    ? input.price_updated_at.toISOString().slice(0, 10) : null
  if (!['manual', 'hita'].includes(input.price_source)
    || input.source_system !== input.price_source
    || input.price_state !== 'priced' || input.price_confidence !== 'high'
    || date !== '2026-07-02') return contact

  const price = money(input.price), recordedSale = money(input.sale_price)
  const recordedList = money(input.list_price), recordedOriginal = money(input.original_price)
  if(price===null)return contact
  // The old Hita-tagged `price` was the public displayed amount. Keep it even
  // where optional comparison fields are absent or disagree. Never invent a
  // struck-through original price from those fields.
  if(input.price_source==='manual'&&(recordedSale!==price||recordedList===null
    ||recordedOriginal!==recordedList||recordedList<price))return contact
  const verifiedOriginal=recordedList!==null&&recordedOriginal===recordedList&&recordedList>=price
    ?recordedList:null
  const list=verifiedOriginal??price

  const rawDiscount = input.online_discount_amount
  const discount = rawDiscount === null || rawDiscount === undefined
    ? null : money(rawDiscount)
  const validDiscount=discount!==null&&discount<price?discount:null

  return {
    price, original_price: verifiedOriginal, list_price: list,
    sale_price: price < list ? price : null,
    online_discount_amount: validDiscount,
    final_online_price: validDiscount === null ? null : price - validDiscount,
    price_display: null, is_promotion: price < list,
    price_provenance: input.price_source === 'manual'
      ? 'legacy-manual-2026-07-02' : 'legacy-hita-pm-approved-2026-11-03',
  }
}

export function isRestoredPublicPricing(value) {
  if (!value || typeof value !== 'object') return false
  const keys = ['price','original_price','list_price','sale_price','online_discount_amount',
    'final_online_price','price_display','is_promotion','price_provenance']
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) return false
  if (value.price === null) return value.original_price === null && value.list_price === null
    && value.sale_price === null && value.online_discount_amount === null
    && value.final_online_price === null && value.price_display === 'Liên hệ báo giá'
    && value.is_promotion === false && value.price_provenance === null
  if (![value.price, value.list_price].every(amount => money(amount) === amount)
    || (value.original_price!==null&&money(value.original_price)!==value.original_price)
    || (value.original_price===null?value.list_price!==value.price:value.original_price!==value.list_price)
    || value.price > value.list_price
    || value.sale_price !== (value.price < value.list_price ? value.price : null)
    || value.is_promotion !== (value.price < value.list_price)
    || value.price_display !== null
    || !['legacy-manual-2026-07-02','legacy-hita-pm-approved-2026-11-03'].includes(value.price_provenance)) return false
  if (value.online_discount_amount === null) return value.final_online_price === null
  return money(value.online_discount_amount) === value.online_discount_amount
    && value.online_discount_amount < value.price
    && value.final_online_price === value.price - value.online_discount_amount
}
