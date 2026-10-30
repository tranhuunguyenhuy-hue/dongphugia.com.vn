import { act, fireEvent, waitFor, within } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
    search: '',
    serverSearch: '',
    history: [''],
    index: 0,
    listeners: new Set<() => void>(),
    pushMock: vi.fn(),
    notify() {
        this.listeners.forEach((listener) => listener())
    },
    push(search: string) {
        this.history = this.history.slice(0, this.index + 1)
        this.history.push(search)
        this.index += 1
        window.history.pushState({}, '', search ? `/?${search}` : '/')
    },
    back() {
        if (this.index > 0) this.index -= 1
        const search = this.history[this.index]
        window.history.pushState({}, '', search ? `/?${search}` : '/')
        window.dispatchEvent(new PopStateEvent('popstate'))
    },
    forward() {
        if (this.index < this.history.length - 1) this.index += 1
        const search = this.history[this.index]
        window.history.pushState({}, '', search ? `/?${search}` : '/')
        window.dispatchEvent(new PopStateEvent('popstate'))
    },
    trackBrowserPush() {
        const search = window.location.search.slice(1)
        if (this.history[this.index] === search) return
        this.history = this.history.slice(0, this.index + 1)
        this.history.push(search)
        this.index += 1
    },
    replaceLocation(search: string) {
        window.history.replaceState({}, '', search ? `/?${search}` : '/')
    },
}))

const trackBrowserPush = () => navigation.trackBrowserPush()

vi.mock('next/navigation', async () => {
    const React = await import('react')
    const subscribe = (listener: () => void) => {
        navigation.listeners.add(listener)
        return () => navigation.listeners.delete(listener)
    }
    const useSearchParams = () => {
        // Model the Vinext adapter regression: its search-param hook stays on
        // the initial value while the browser URL and history move correctly.
        const search = React.useSyncExternalStore(subscribe, () => navigation.search, () => navigation.serverSearch)
        return React.useMemo(() => new URLSearchParams(search), [search])
    }

    return {
        useRouter: () => ({
            push: (href: string) => {
                navigation.pushMock(href)
                navigation.push(new URL(href, 'https://preview.invalid').search.slice(1))
            },
        }),
        usePathname: () => '/thiet-bi-bep',
        useSearchParams,
    }
})

vi.mock('@/components/ui/product-card', () => ({
    ProductCard: ({ product }: { product: { slug: string } }) => <div data-testid="product-card">{product.slug}</div>,
}))

import { CategoryRootFeaturedProducts } from './category-root-featured-products'
import { CategoryFilterPanel } from './category-filter-panel'
import type { ProductCardProps } from '@/components/ui/product-card'

const product = (id: number, slug: string, brandSlug: string): ProductCardProps['product'] => ({
    id,
    slug,
    brands: { slug: brandSlug, name: brandSlug },
    subcategories: { slug: 'voi-rua-chen' },
    url: `/thiet-bi-bep/voi-rua-chen/${slug}`,
} as ProductCardProps['product'])

const brands = [
    { id: 'toto', slug: 'toto', name: 'TOTO' },
    { id: 'inax', slug: 'inax', name: 'INAX' },
]
const filterableFeaturedProducts = [
    product(1, 'toto-1', 'toto'),
    product(2, 'toto-2', 'toto'),
    product(3, 'inax-1', 'inax'),
    product(4, 'inax-2', 'inax'),
]

function SnapshotCategoryRoot() {
    return (
        <>
            <CategoryFilterPanel mode="snapshot" brands={brands} />
            <CategoryRootFeaturedProducts
                basePath="/thiet-bi-bep"
                featuredProducts={[product(99, 'default-featured', 'brand-a')]}
                filterableFeaturedProducts={filterableFeaturedProducts}
                featuredGridClassName="grid"
            />
        </>
    )
}

function serverMarkup() {
    return renderToString(<SnapshotCategoryRoot />)
}

function hydrate(container: HTMLElement, onRecoverableError: (error: unknown) => void): Root {
    let root: Root | undefined
    act(() => {
        root = hydrateRoot(container, <SnapshotCategoryRoot />, {onRecoverableError})
    })
    return root!
}

beforeEach(() => {
    navigation.search = ''
    navigation.serverSearch = ''
    navigation.history = ['']
    navigation.index = 0
    navigation.pushMock.mockReset()
    navigation.replaceLocation('')
    window.addEventListener('dpg:search-params-change', trackBrowserPush)
})

afterEach(() => {
    window.removeEventListener('dpg:search-params-change', trackBrowserPush)
    navigation.listeners.clear()
    navigation.search = ''
    navigation.serverSearch = ''
    navigation.history = ['']
    navigation.index = 0
    navigation.pushMock.mockReset()
    navigation.replaceLocation('')
})

describe('snapshot category-root URL hydration', () => {
    it('uses the browser URL for multi-brand toggles, counts, history, and refresh when Next search params are stale', async () => {
        navigation.search = ''
        navigation.replaceLocation('')
        navigation.history = ['']

        const html = serverMarkup()
        expect(html).toContain('Bật JavaScript để xem sản phẩm nổi bật và lọc theo thương hiệu.')
        expect(html).toContain('aria-label="Sản phẩm nổi bật"')
        expect(html).not.toContain('data-testid="product-card"')
        expect(html).not.toContain('aria-pressed="true"')

        const container = document.createElement('div')
        container.innerHTML = html
        document.body.append(container)
        const hydrationErrors: unknown[] = []
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        let root = hydrate(container, error => hydrationErrors.push(error))
        let view = within(container)

        await waitFor(() => {
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual(['default-featured'])
        })
        fireEvent.click(view.getByRole('button', { name: 'TOTO' }))
        await waitFor(() => {
            expect(window.location.search).toBe('?brands=toto')
            expect(navigation.pushMock).not.toHaveBeenCalled()
            expect(view.getByRole('button', { name: 'TOTO' })).toHaveAttribute('aria-pressed', 'true')
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual(['toto-1', 'toto-2'])
            expect(view.getByText('2 sản phẩm')).toBeVisible()
        })
        expect(hydrationErrors).toEqual([])
        expect(consoleError).not.toHaveBeenCalled()

        fireEvent.click(view.getByRole('button', { name: 'INAX' }))
        await waitFor(() => {
            expect(window.location.search).toBe('?brands=toto%2Cinax')
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual([
                'toto-1', 'toto-2', 'inax-1', 'inax-2',
            ])
            expect(view.getByText('4 sản phẩm')).toBeVisible()
            expect(view.getByRole('button', { name: 'TOTO' })).toHaveAttribute('aria-pressed', 'true')
            expect(view.getByRole('button', { name: 'INAX' })).toHaveAttribute('aria-pressed', 'true')
        })

        fireEvent.click(view.getByRole('button', { name: 'TOTO' }))
        await waitFor(() => {
            expect(window.location.search).toBe('?brands=inax')
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual(['inax-1', 'inax-2'])
            expect(view.getByRole('button', { name: 'TOTO' })).toHaveAttribute('aria-pressed', 'false')
            expect(view.getByRole('button', { name: 'INAX' })).toHaveAttribute('aria-pressed', 'true')
        })

        act(() => navigation.back())
        await waitFor(() => {
            expect(view.getAllByTestId('product-card')).toHaveLength(4)
            expect(view.getByRole('button', { name: 'TOTO' })).toHaveAttribute('aria-pressed', 'true')
        })

        act(() => navigation.forward())
        await waitFor(() => {
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual(['inax-1', 'inax-2'])
        })

        await act(async () => root.unmount())
        container.remove()

        // A refresh repeats neutral server markup, then restores the direct URL
        // even while the framework search-param adapter remains stale.
        navigation.replaceLocation('brands=toto%2Cinax')
        navigation.serverSearch = ''
        const refreshedHtml = serverMarkup()
        expect(refreshedHtml).toContain('Bật JavaScript để xem sản phẩm nổi bật và lọc theo thương hiệu.')
        expect(refreshedHtml).not.toContain('inax-1')
        const refreshedContainer = document.createElement('div')
        refreshedContainer.innerHTML = refreshedHtml
        document.body.append(refreshedContainer)
        const refreshHydrationErrors: unknown[] = []
        root = hydrate(refreshedContainer, error => refreshHydrationErrors.push(error))
        view = within(refreshedContainer)

        await waitFor(() => {
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual([
                'toto-1', 'toto-2', 'inax-1', 'inax-2',
            ])
            expect(view.getByRole('button', { name: 'TOTO' })).toHaveAttribute('aria-pressed', 'true')
            expect(view.getByRole('button', { name: 'INAX' })).toHaveAttribute('aria-pressed', 'true')
        })
        expect(refreshHydrationErrors).toEqual([])

        await act(async () => root.unmount())
        refreshedContainer.remove()
    })
})
