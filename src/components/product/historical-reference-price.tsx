type HistoricalReferencePrice = {
    amountVnd: number
    recordedUpdateDate: string
    provenance: string
} | null | undefined

export function HistoricalReferencePriceNotice({ referencePrice }: { referencePrice: HistoricalReferencePrice }) {
    if (referencePrice?.provenance !== 'legacy-manual-public-display' ||
        referencePrice.recordedUpdateDate !== '2026-07-02' ||
        !Number.isSafeInteger(referencePrice.amountVnd) || referencePrice.amountVnd <= 0) return null

    return (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-stone-800">
            <p className="text-sm font-bold">Giá tham khảo từ dữ liệu công khai lưu trữ</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(referencePrice.amountVnd)}</p>
            <p className="mt-2 text-xs leading-relaxed">Mốc cập nhật giá ghi trong dữ liệu: 02/07/2026. Chưa xác nhận thời điểm có hiệu lực hoặc giá bán hiện tại; vui lòng liên hệ để nhận báo giá mới.</p>
        </div>
    )
}
