import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  search: new URLSearchParams(),
  pathname: '/thiet-bi-bep/voi-rua-chen',
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.search,
  usePathname: () => navigation.pathname,
}))

import { AdvancedSidebarFilter } from './advanced-sidebar-filter'

const availableFilters = {
  brands: [{ name: 'Brand A', slug: 'brand-a' }, { name: 'Brand B', slug: 'brand-b' }],
  subcategories: [],
  materials: [],
  origins: [],
  features: [],
  colors: [],
}

const runtimeConfig = {
  snapshotMode: true,
  profileKey: null,
  hideColorFilter: true,
  enableSpecFilters: false,
  enableProductTypeTabs: false,
  readyForRefactor: false,
  relationPriority: ['brand'] as Array<'brand'>,
}

function renderFilter() {
  return render(<AdvancedSidebarFilter availableFilters={availableFilters} runtimeConfig={runtimeConfig}
    hideSubcategoryFilter hideColorFilter />)
}

describe('canonical snapshot listing filters', () => {
  beforeEach(() => {
    navigation.search = new URLSearchParams()
    navigation.push.mockReset()
  })

  it('writes selected brands to the URL and restores active state across back and forward navigation', () => {
    const view = renderFilter()
    expect(screen.queryByText('Khoảng giá')).toBeNull()
    expect(screen.queryByText('Khuyến mãi')).toBeNull()

    fireEvent.click(screen.getByTitle('Brand A'))
    expect(navigation.push).toHaveBeenLastCalledWith('/thiet-bi-bep/voi-rua-chen?brand=brand-a&page=1', { scroll: false })

    navigation.search = new URLSearchParams('brand=brand-a&page=1')
    view.rerender(<AdvancedSidebarFilter availableFilters={availableFilters} runtimeConfig={runtimeConfig}
      hideSubcategoryFilter hideColorFilter />)
    expect(screen.getByTitle('Brand A').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTitle('Brand B'))
    expect(navigation.push).toHaveBeenLastCalledWith('/thiet-bi-bep/voi-rua-chen?brand=brand-a%2Cbrand-b&page=1', { scroll: false })

    navigation.search = new URLSearchParams('brand=brand-a&page=1')
    view.rerender(<AdvancedSidebarFilter availableFilters={availableFilters} runtimeConfig={runtimeConfig}
      hideSubcategoryFilter hideColorFilter />)
    expect(screen.getByTitle('Brand A').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTitle('Brand B').getAttribute('aria-pressed')).toBe('false')

    navigation.search = new URLSearchParams('brand=brand-a,brand-b&page=1')
    view.rerender(<AdvancedSidebarFilter availableFilters={availableFilters} runtimeConfig={runtimeConfig}
      hideSubcategoryFilter hideColorFilter />)
    expect(screen.getByTitle('Brand A').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTitle('Brand B').getAttribute('aria-pressed')).toBe('true')
  })
})
