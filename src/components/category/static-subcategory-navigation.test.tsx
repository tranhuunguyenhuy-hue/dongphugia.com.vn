import type { ComponentProps, PropsWithChildren } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StaticSubcategoryNavigation } from './static-subcategory-navigation'

type LinkProps = PropsWithChildren<ComponentProps<'a'>>

vi.mock('next/link', () => ({
    default: ({ children, ...props }: LinkProps) => <a {...props}>{children}</a>,
}))

describe('StaticSubcategoryNavigation', () => {
    it('renders accessible native-scroll links and retains the active state without controls', () => {
        render(
            <StaticSubcategoryNavigation
                basePath="/thiet-bi-ve-sinh"
                activeSlug="bon-cau"
                subcategories={[
                    { id: 1, name: 'Bồn cầu', slug: 'bon-cau', thumbnail_url: '/toilet.webp' },
                    { id: 2, name: 'Lavabo', slug: 'lavabo', thumbnail_url: '/basin.webp' },
                ]}
            />,
        )

        const activeLink = screen.getByRole('link', { name: /Bồn cầu/ })
        expect(activeLink).toHaveAttribute('href', '/thiet-bi-ve-sinh/bon-cau')
        expect(activeLink).toHaveAttribute('aria-current', 'page')
        expect(screen.getByAltText('Lavabo')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
