import { act, fireEvent, waitFor, within } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
        this.search = search
        this.notify()
    },
    back() {
        if (this.index > 0) this.index -= 1
        this.search = this.history[this.index]
        this.notify()
    },
    forward() {
        if (this.index < this.history.length - 1) this.index += 1
        this.search = this.history[this.index]
        this.notify()
    },
}))

vi.mock('next/navigation', async () => {
    const React = await import('react')
    const subscribe = (listener: () => void) => {
        navigation.listeners.add(listener)
        return () => navigation.listeners.delete(listener)
    }
    const useSearchParams = () => {
        const search = React.useSyncExternalStore(
            subscribe,
            () => navigation.search,
            () => navigation.serverSearch,
        )
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
    { id: 'brand-a', slug: 'brand-a', name: 'Brand A' },
    { id: 'brand-b', slug: 'brand-b', name: 'Brand B' },
]
const filterableFeaturedProducts = [
    product(1, 'brand-a-1', 'brand-a'),
    product(2, 'brand-a-2', 'brand-a'),
    product(3, 'brand-b-1', 'brand-b'),
    product(4, 'brand-b-2', 'brand-b'),
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

afterEach(() => {
    navigation.listeners.clear()
    navigation.search = ''
    navigation.serverSearch = ''
    navigation.history = ['']
    navigation.index = 0
    navigation.pushMock.mockReset()
})

describe('snapshot category-root URL hydration', () => {
    it('hydrates direct and refreshed multi-brand URLs, then follows push, back, and forward', async () => {
        navigation.search = 'brands=brand-a%2Cbrand-b'
        navigation.history = [navigation.search]

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
            expect(view.getAllByTestId('product-card')).toHaveLength(4)
            expect(view.getByRole('button', { name: 'Brand A' })).toHaveAttribute('aria-pressed', 'true')
            expect(view.getByRole('button', { name: 'Brand B' })).toHaveAttribute('aria-pressed', 'true')
        })
        expect(hydrationErrors).toEqual([])
        expect(consoleError).not.toHaveBeenCalled()

        fireEvent.click(view.getByRole('button', { name: 'Brand A' }))
        await waitFor(() => {
            expect(navigation.pushMock).toHaveBeenLastCalledWith('/thiet-bi-bep?brands=brand-b')
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual(['brand-b-1', 'brand-b-2'])
            expect(view.getByRole('button', { name: 'Brand A' })).toHaveAttribute('aria-pressed', 'false')
            expect(view.getByRole('button', { name: 'Brand B' })).toHaveAttribute('aria-pressed', 'true')
        })

        act(() => navigation.back())
        await waitFor(() => {
            expect(view.getAllByTestId('product-card')).toHaveLength(4)
            expect(view.getByRole('button', { name: 'Brand A' })).toHaveAttribute('aria-pressed', 'true')
        })

        act(() => navigation.forward())
        await waitFor(() => {
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual(['brand-b-1', 'brand-b-2'])
        })

        await act(async () => root.unmount())
        container.remove()

        // A refresh repeats the neutral server markup, then restores the URL state after hydration.
        navigation.serverSearch = ''
        const refreshedHtml = serverMarkup()
        expect(refreshedHtml).toContain('Bật JavaScript để xem sản phẩm nổi bật và lọc theo thương hiệu.')
        expect(refreshedHtml).not.toContain('brand-b-1')
        const refreshedContainer = document.createElement('div')
        refreshedContainer.innerHTML = refreshedHtml
        document.body.append(refreshedContainer)
        const refreshHydrationErrors: unknown[] = []
        root = hydrate(refreshedContainer, error => refreshHydrationErrors.push(error))
        view = within(refreshedContainer)

        await waitFor(() => {
            expect(view.getAllByTestId('product-card').map(card => card.textContent)).toEqual(['brand-b-1', 'brand-b-2'])
            expect(view.getByRole('button', { name: 'Brand B' })).toHaveAttribute('aria-pressed', 'true')
        })
        expect(refreshHydrationErrors).toEqual([])

        await act(async () => root.unmount())
        refreshedContainer.remove()
    })
})
