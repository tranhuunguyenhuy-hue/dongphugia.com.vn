import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const toiletListingPage = readFileSync(
    resolve(process.cwd(), 'src/app/(public)/thiet-bi-ve-sinh/[sub]/page.tsx'),
    'utf8',
)

describe('toilet listing pagination contract', () => {
    it('limits only the initial page to 12 products while retaining total-aware pagination', () => {
        expect(toiletListingPage).toContain('const PAGE_SIZE = 12')
        expect(toiletListingPage).toContain('page: currentPage,')
        expect(toiletListingPage).toContain('pageSize: PAGE_SIZE,')
        expect(toiletListingPage).toContain("{total.toLocaleString('vi-VN')}")
        expect(toiletListingPage).toContain('sản phẩm')
        expect(toiletListingPage).toContain(
            '<ListingPagination totalPages={totalPages} currentPage={currentPage} />',
        )
    })
})
