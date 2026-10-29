import type { ActiveFilterDict } from './active-filters'
import type { AvailableFiltersData } from './advanced-sidebar-filter'
import type { ListingRuntimeConfig } from '@/lib/public-api-products'

export type PreviewListingSectionProps = {
  categorySlug: string
  listingSlug: string
  basePath: string
  pageSize: 12 | 24
  availableFilters: AvailableFiltersData
  runtimeConfig: ListingRuntimeConfig
  filterDict: ActiveFilterDict
}
