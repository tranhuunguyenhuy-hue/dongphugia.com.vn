export type CatalogUxGroupKey =
  | 'bon-cau'
  | 'lavabo'
  | 'sen-voi'
  | 'gach-op-lat'
  | 'thiet-bi-bep'
  | 'vat-lieu-nuoc'

export type CatalogUxReadinessStatus =
  | 'ready-for-backend-refactor'
  | 'data-cleanup-first'
  | 'policy-decision-first'

export type CatalogRelationField = 'brand' | 'origin' | 'color' | 'material'

export type CatalogFilterSpecProfile = {
  label: string
  source: 'spec' | 'relation' | 'derived'
  recommendation: 'filter-ready' | 'pdp-only' | 'not-ready'
  note?: string
}

export type CatalogVisibilityPolicy = {
  listingEligible: Array<'default' | 'low_priority'>
  searchVisible: 'visible'
  sitemapRule: 'public-pdp-indexable'
  canonicalRule: 'product-url'
}

export type CatalogUxProfile = {
  key: CatalogUxGroupKey
  label: string
  categorySlug: string
  subcategorySlugs: string[]
  readiness: CatalogUxReadinessStatus
  visibility: CatalogVisibilityPolicy
  listingUi: {
    hideColorFilter: boolean
    enableSpecFilters: boolean
    enableProductTypeTabs: boolean
  }
  attributeProfiles: CatalogFilterSpecProfile[]
  relationPriority: CatalogRelationField[]
  productTypeStrategy: 'strong' | 'mixed' | 'weak'
  useCaseModeled: boolean
  notes: string[]
}

export const CATALOG_UX_PROFILES: CatalogUxProfile[] = [
  {
    key: 'bon-cau',
    label: 'Bồn cầu',
    categorySlug: 'thiet-bi-ve-sinh',
    subcategorySlugs: ['bon-cau'],
    readiness: 'ready-for-backend-refactor',
    visibility: {
      listingEligible: ['default', 'low_priority'],
      searchVisible: 'visible',
      sitemapRule: 'public-pdp-indexable',
      canonicalRule: 'product-url',
    },
    listingUi: {
      hideColorFilter: true,
      enableSpecFilters: true,
      enableProductTypeTabs: true,
    },
    relationPriority: ['brand', 'color', 'origin', 'material'],
    productTypeStrategy: 'strong',
    useCaseModeled: false,
    attributeProfiles: [
      { label: 'Thương hiệu', source: 'relation', recommendation: 'filter-ready' },
      { label: 'Loại thân cầu', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Loại nắp', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Kiểu thoát', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Kiểu xả', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Màu sắc', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Hệ thống xả', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Thiết kế', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Lượng nước xả', source: 'spec', recommendation: 'pdp-only', note: 'Distinct values còn phân mảnh, nên chuẩn hóa trước khi filter rộng.' },
      { label: 'Kích thước (DxRxC)', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Tâm xả', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Công nghệ', source: 'spec', recommendation: 'pdp-only' },
    ],
    notes: [
      'Có khoảng cách search-only lớn, phù hợp chiến lược giữ PDP public nhưng giảm nhiễu listing.',
      'Phụ kiện bồn cầu đang chiếm tỷ trọng lớn, nên cần pattern listing riêng thay vì trộn với toilet core SKUs.',
    ],
  },
  {
    key: 'lavabo',
    label: 'Lavabo',
    categorySlug: 'thiet-bi-ve-sinh',
    subcategorySlugs: ['lavabo'],
    readiness: 'ready-for-backend-refactor',
    visibility: {
      listingEligible: ['default', 'low_priority'],
      searchVisible: 'visible',
      sitemapRule: 'public-pdp-indexable',
      canonicalRule: 'product-url',
    },
    listingUi: {
      hideColorFilter: true,
      enableSpecFilters: true,
      enableProductTypeTabs: true,
    },
    relationPriority: ['brand', 'color', 'origin', 'material'],
    productTypeStrategy: 'strong',
    useCaseModeled: false,
    attributeProfiles: [
      { label: 'Thương hiệu', source: 'relation', recommendation: 'filter-ready' },
      { label: 'Hình dáng', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Lỗ bắt vòi', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Lỗ xả tràn nước', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Chất liệu', source: 'spec', recommendation: 'pdp-only', note: 'Coverage cao nhưng values còn rộng, nên gom taxonomy chất liệu trước.' },
      { label: 'Màu sắc', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Kích thước (DxRxC)', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Vị trí lắp', source: 'spec', recommendation: 'pdp-only' },
    ],
    notes: [
      'Lavabo có dữ liệu khá sạch cho filter hình dáng và lỗ kỹ thuật.',
      'Product sub-type hiện gần như trống, nên logic ưu tiên nên bám product_type trước.',
    ],
  },
  {
    key: 'sen-voi',
    label: 'Sen vòi',
    categorySlug: 'thiet-bi-ve-sinh',
    subcategorySlugs: ['sen-tam', 'voi-chau'],
    readiness: 'ready-for-backend-refactor',
    visibility: {
      listingEligible: ['default', 'low_priority'],
      searchVisible: 'visible',
      sitemapRule: 'public-pdp-indexable',
      canonicalRule: 'product-url',
    },
    listingUi: {
      hideColorFilter: true,
      enableSpecFilters: true,
      enableProductTypeTabs: true,
    },
    relationPriority: ['brand', 'color', 'origin', 'material'],
    productTypeStrategy: 'mixed',
    useCaseModeled: false,
    attributeProfiles: [
      { label: 'Thương hiệu', source: 'relation', recommendation: 'filter-ready' },
      { label: 'Chế độ', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Chất liệu', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Lớp mạ (màu)', source: 'spec', recommendation: 'pdp-only', note: 'Rất quan trọng cho PDP/variant, nhưng chưa nên đẩy thành filter toàn cục cho TBVS.' },
      { label: 'Điều khiển', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Áp lực nước', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Loại vòi', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Vị trí lắp vòi', source: 'spec', recommendation: 'pdp-only' },
    ],
    notes: [
      'Search-only gap rất lớn, phù hợp với chiến lược merchandising tách hàng phụ kiện/biến thể khỏi listing chính.',
      'Màu sắc nên ưu tiên ở PDP variant selector và specs, không nên áp filter listing rộng ở phase hiện tại.',
    ],
  },
  {
    key: 'gach-op-lat',
    label: 'Gạch ốp lát',
    categorySlug: 'gach-op-lat',
    subcategorySlugs: [
      'gach-op-lat',
      'gach-op-tuong',
      'gach-inax-ecocarat',
      'gach-trang-tri',
      'gach-thiet-ke-xi-mang',
      'gach-van-da-marble',
      'gach-van-da-tu-nhien',
      'gach-van-go',
    ],
    readiness: 'data-cleanup-first',
    visibility: {
      listingEligible: ['default', 'low_priority'],
      searchVisible: 'visible',
      sitemapRule: 'public-pdp-indexable',
      canonicalRule: 'product-url',
    },
    listingUi: {
      hideColorFilter: false,
      enableSpecFilters: false,
      enableProductTypeTabs: false,
    },
    relationPriority: ['brand', 'origin', 'color', 'material'],
    productTypeStrategy: 'weak',
    useCaseModeled: false,
    attributeProfiles: [
      { label: 'Thương hiệu', source: 'relation', recommendation: 'filter-ready' },
      { label: 'Nơi sản xuất', source: 'spec', recommendation: 'filter-ready', note: 'Tạm dùng được, nhưng chưa đủ cho UX gạch dài hạn.' },
      { label: 'Bảo hành', source: 'spec', recommendation: 'pdp-only' },
    ],
    notes: [
      'Taxonomy và product_type cho gạch còn thiếu đáng kể, chưa nên triển khai filter/listing UX nâng cao.',
      'Cần dọn taxonomy trước khi thiết kế flow SEO + listing pattern cho gạch.',
    ],
  },
  {
    key: 'thiet-bi-bep',
    label: 'Thiết bị bếp',
    categorySlug: 'thiet-bi-bep',
    subcategorySlugs: [
      'chau-rua-chen',
      'voi-rua-chen',
      'bep-dien-tu',
      'bep-gas',
      'may-hut-mui',
      'may-rua-chen',
      'lo-nuong',
      'phu-kien-bep',
      'phu-kien-chau-rua-chen',
      'thiet-bi-bep-khac',
    ],
    readiness: 'ready-for-backend-refactor',
    visibility: {
      listingEligible: ['default', 'low_priority'],
      searchVisible: 'visible',
      sitemapRule: 'public-pdp-indexable',
      canonicalRule: 'product-url',
    },
    listingUi: {
      hideColorFilter: true,
      enableSpecFilters: true,
      enableProductTypeTabs: false,
    },
    relationPriority: ['brand', 'material', 'origin', 'color'],
    productTypeStrategy: 'mixed',
    useCaseModeled: false,
    attributeProfiles: [
      { label: 'Thương hiệu', source: 'relation', recommendation: 'filter-ready' },
      { label: 'Chất liệu', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Loại vòi', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Bảo hành', source: 'spec', recommendation: 'filter-ready' },
      { label: 'Chế độ', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Vị trí lắp vòi', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Chế độ xả nước đầu vòi', source: 'spec', recommendation: 'pdp-only' },
      { label: 'Kích thước (DxRxC)', source: 'spec', recommendation: 'pdp-only' },
    ],
    notes: [
      'Màu sắc có coverage thấp, chưa nên dùng như filter chính ở listing bếp.',
      'Product type hiện đủ hữu ích cho backend merchandising, nhưng chưa cần bật tab loại sản phẩm ở mọi subpage.',
    ],
  },
  {
    key: 'vat-lieu-nuoc',
    label: 'Vật liệu nước',
    categorySlug: 'vat-lieu-nuoc',
    subcategorySlugs: ['loc-nuoc', 'may-nuoc-nong', 'bon-chua-nuoc', 'may-bom-nuoc'],
    readiness: 'data-cleanup-first',
    visibility: {
      listingEligible: ['default', 'low_priority'],
      searchVisible: 'visible',
      sitemapRule: 'public-pdp-indexable',
      canonicalRule: 'product-url',
    },
    listingUi: {
      hideColorFilter: true,
      enableSpecFilters: false,
      enableProductTypeTabs: false,
    },
    relationPriority: ['brand', 'origin', 'material', 'color'],
    productTypeStrategy: 'weak',
    useCaseModeled: false,
    attributeProfiles: [
      { label: 'Thương hiệu', source: 'relation', recommendation: 'filter-ready' },
      { label: 'capacity_liters', source: 'spec', recommendation: 'pdp-only' },
      { label: 'power_watts', source: 'spec', recommendation: 'not-ready' },
    ],
    notes: [
      'Dữ liệu product_type còn quá mỏng, chưa nên mở UX/filter nâng cao.',
      'Cần cleanup specs và chuẩn hóa attribute trước khi đẩy filter sâu cho vật liệu nước.',
    ],
  },
]

export function getCatalogUxProfileByGroup(group: CatalogUxGroupKey) {
  return CATALOG_UX_PROFILES.find((profile) => profile.key === group) ?? null
}

export function getCatalogUxProfileByTaxonomy(input: {
  categorySlug?: string | null
  subcategorySlug?: string | null
}) {
  return (
    CATALOG_UX_PROFILES.find((profile) => {
      if (profile.categorySlug !== input.categorySlug) return false
      if (!input.subcategorySlug) return false
      return profile.subcategorySlugs.includes(input.subcategorySlug)
    }) ?? null
  )
}

export function getCatalogFilterReadySpecLabels(input: {
  categorySlug?: string | null
  subcategorySlug?: string | null
}) {
  const profile = getCatalogUxProfileByTaxonomy(input)
  if (!profile) return null

  return profile.attributeProfiles
    .filter((profileItem) => profileItem.recommendation === 'filter-ready' && profileItem.source === 'spec')
    .map((profileItem) => profileItem.label)
}
