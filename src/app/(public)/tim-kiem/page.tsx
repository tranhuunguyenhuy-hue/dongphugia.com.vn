import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Package2, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { ProductCard } from '@/components/ui/product-card'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
    id: number
    sku: string
    name: string
    slug: string
    price: number | null
    original_price?: number | null
    online_discount_amount?: number | null
    price_display: string | null
    image_main_url: string | null
    is_promotion?: boolean
    is_featured?: boolean
    stock_status?: string | null
    display_name?: string | null
    category_slug: string
    subcategory_slug: string | null
    brand_name: string | null
    url: string
    categories?: any
    subcategories?: any
    brands?: any
}

interface SearchResponse {
    results: SearchResult[]
    total: number
    page: number
    limit: number
    query: string
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
    const { q } = await searchParams
    if (!q) return { title: 'Tìm kiếm sản phẩm' }
    return {
        title: `Kết quả tìm kiếm "${q}"`,
        description: `Kết quả tìm kiếm cho "${q}" tại Đông Phú Gia — Thiết bị vệ sinh, gạch ốp lát, thiết bị bếp chính hãng.`,
        robots: { index: false, follow: true },
    }
}

// ── Server data fetch ─────────────────────────────────────────────────────────

async function fetchSearchResults(q: string, page: number): Promise<SearchResponse> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const limit = 24
    const res = await fetch(
        `${baseUrl}/api/search?q=${encodeURIComponent(q)}&limit=${limit}&page=${page}`,
        { next: { revalidate: 60 } }
    )
    if (!res.ok) return { results: [], total: 0, page, limit, query: q }
    return res.json()
}

// ── Inline Search Form (client-side redirect) ─────────────────────────────────
function SearchForm({ defaultValue }: { defaultValue: string }) {
    return (
        <form method="GET" action="/tim-kiem" className="flex flex-col sm:flex-row gap-3 max-w-2xl w-full">
            <div className="flex-1 flex items-center h-14 rounded-[16px] border border-stone-200 bg-white px-5 gap-3 focus-within:border-brand-500 focus-within:shadow-[0_0_0_3px_rgba(46,122,150,0.12)] transition-all">
                <Search className="w-5 h-5 text-stone-400 shrink-0" />
                <input
                    name="q"
                    defaultValue={defaultValue}
                    placeholder="Nhập tên sản phẩm, mã SKU, thương hiệu..."
                    className="flex-1 text-[15px] outline-none bg-transparent text-stone-900 placeholder:text-stone-400"
                    autoComplete="off"
                />
            </div>
            <button type="submit" className="h-14 px-8 bg-brand-600 hover:bg-brand-700 text-white text-[15px] font-medium rounded-[16px] transition-colors shrink-0 shadow-sm">
                Tìm kiếm
            </button>
        </form>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface PageProps {
    searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: PageProps) {
    const { q, page: pageStr } = await searchParams
    const query = q?.trim() ?? ''
    const page = Math.max(parseInt(pageStr ?? '1'), 1)

    const data = query.length >= 2 ? await fetchSearchResults(query, page) : null

    const totalPages = data ? Math.ceil(data.total / (data.limit ?? 24)) : 1

    return (
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-8 lg:py-12">
            {/* Header */}
            <div className="mb-10">
                <nav className="flex items-center gap-2 text-[13px] font-medium text-stone-500 mb-6">
                    <Link href="/" className="hover:text-stone-900 transition-colors">Trang chủ</Link>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span className="text-stone-900">Tìm kiếm</span>
                </nav>
                <h1 className="text-3xl font-bold text-stone-900 mb-6 tracking-tight">
                    {query
                        ? <>Kết quả cho <span className="text-brand-600">"{query}"</span></>
                        : 'Tìm kiếm sản phẩm'
                    }
                </h1>
                <SearchForm defaultValue={query} />
            </div>

            {/* No query yet */}
            {!query && (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-stone-50/50 rounded-3xl border border-stone-100">
                    <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mb-6">
                        <Search className="w-8 h-8 text-stone-300" />
                    </div>
                    <p className="text-xl font-bold text-stone-800 mb-2">Nhập từ khóa để bắt đầu tìm kiếm</p>
                    <p className="text-stone-500 text-[15px] max-w-md">
                        Thử tìm tên sản phẩm, mã SKU, hoặc tên thương hiệu như "TOTO", "HCG", "Hafele"...
                    </p>
                </div>
            )}

            {/* Results */}
            {data && (
                <>
                    {/* Stats */}
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-stone-100">
                        <p className="text-[15px] text-stone-600">
                            {data.total > 0
                                ? <>Tìm thấy <strong className="text-stone-900 font-bold">{data.total.toLocaleString('vi-VN')}</strong> sản phẩm phù hợp</>
                                : 'Không tìm thấy sản phẩm nào'
                            }
                        </p>
                    </div>

                    {/* Grid */}
                    {data.results.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                            {data.results.map(item => (
                                <ProductCard key={item.id} product={item} href={item.url} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center bg-stone-50/50 rounded-3xl border border-stone-100">
                            <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mb-6">
                                <Package2 className="w-8 h-8 text-stone-300" />
                            </div>
                            <p className="text-xl font-bold text-stone-800 mb-2">Không có kết quả</p>
                            <p className="text-stone-500 text-[15px] max-w-sm mb-8">
                                Không tìm thấy sản phẩm nào cho "{query}". Hãy thử dùng từ khóa khác hoặc tham khảo các gợi ý bên dưới.
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {['TOTO', 'HCG', 'CAESAR', 'Hafele', 'Gạch ốp lát'].map(s => (
                                    <Link key={s} href={`/tim-kiem?q=${encodeURIComponent(s)}`} className="px-4 py-2 text-[14px] font-medium bg-white border border-stone-200 text-stone-700 rounded-full hover:border-brand-500 hover:text-brand-600 hover:shadow-sm transition-all">
                                        {s}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-12 flex-wrap">
                            {page > 1 && (
                                <Link href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${page - 1}`} className="px-5 py-2.5 rounded-xl border border-stone-200 bg-white text-[14px] font-medium hover:border-brand-500 hover:text-brand-600 shadow-sm transition-all">
                                    ← Trước
                                </Link>
                            )}
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                const p = i + 1
                                return (
                                    <Link
                                        key={p}
                                        href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${p}`}
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-[14px] font-bold transition-all shadow-sm ${p === page ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border border-stone-200 text-stone-600 hover:border-brand-500 hover:text-brand-600'}`}
                                    >
                                        {p}
                                    </Link>
                                )
                            })}
                            {page < totalPages && (
                                <Link href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${page + 1}`} className="px-5 py-2.5 rounded-xl border border-stone-200 bg-white text-[14px] font-medium hover:border-brand-500 hover:text-brand-600 shadow-sm transition-all">
                                    Tiếp →
                                </Link>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
