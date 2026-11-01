import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HistoricalReferencePriceNotice } from './historical-reference-price'

it('labels an independently validated historical value without a current selling-price claim', () => {
    const html = renderToStaticMarkup(<HistoricalReferencePriceNotice referencePrice={{amountVnd:1200000,recordedUpdateDate:'2026-07-02',provenance:'legacy-manual-public-display'}} />)
    expect(html).toContain('Giá tham khảo từ dữ liệu công khai lưu trữ')
    expect(html).toContain('1.200.000')
    expect(html).toContain('Mốc cập nhật giá ghi trong dữ liệu: 02/07/2026')
    expect(html).toContain('Chưa xác nhận thời điểm có hiệu lực hoặc giá bán hiện tại')
    expect(renderToStaticMarkup(<HistoricalReferencePriceNotice referencePrice={null} />)).toBe('')
    expect(renderToStaticMarkup(<HistoricalReferencePriceNotice referencePrice={{amountVnd:0,recordedUpdateDate:'2026-07-02',provenance:'legacy-manual-public-display'}} />)).toBe('')
})
