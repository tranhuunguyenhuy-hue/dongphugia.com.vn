import { hashObject } from './hash'

export const POLICY_CONTRACT = {
    id: 'leo-489-leo-493-media-policy',
    version: '3.1',
    decisions: [
        { action: 'KEEP_PRODUCT', label: 'GIỮ — Hình sản phẩm' },
        { action: 'KEEP_TECHNICAL', label: 'GIỮ — Bản vẽ/HDSD' },
        { action: 'KEEP_TEMPORARY', label: 'GIỮ TẠM — Chưa chứng minh nguồn, không phải showroom Hita' },
        { action: 'REMOVE_HITA_SHOWROOM', label: 'XOÁ — Showroom/cửa hàng Hita' },
        { action: 'HUMAN_REVIEW', label: 'CẦN XEM' },
    ],
    rules: [
        'No official-image search, acquisition, replacement or placeholder.',
        'Retain existing product/render and drawing/instruction assets.',
        'Retain non-showroom unknown assets with residual copyright risk.',
        'Remove only visually confirmed Hita showroom/store/display photos.',
        'Preserve existing embedded description sourceIds/assets; strip Hita click-through links; add no new images.',
        'Bunny preview is direct in private review; Hita preview is manual one-asset only; no automatic Hita fetch/crawl/copy/rehost.',
        'Production/public/Bunny/CDN/DNS/database mutation is prohibited.',
    ],
} as const

export const POLICY_HASH = hashObject(POLICY_CONTRACT)

export type PolicyAction = typeof POLICY_CONTRACT.decisions[number]['action']
