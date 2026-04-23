import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Package2, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
    id: number
    sku: string
    name: string
    slug: string
    price: number | null
    price_display: string | null
    image_main_url: string | null
    category_slug: string
    subcategory_slug: string | null
    brand_name: string | null
    url: string
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
    if (!q) return { title: 'Tìm kiếm sản phẩm | Đông Phú Gia' }
    return {
        title: `Kết quả tìm kiếm "${q}" | Đông Phú Gia`,
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

// ── Components ────────────────────────────────────────────────────────────────

function ProductCard({ item }: { item: SearchResult }) {
    return (
        <Link href={item.url} className="group flex flex-col rounded-2xl border border-neutral-100 bg-white hover:border-[#44A0BA]/40 hover:shadow-[0_4px_20px_rgba(46,122,150,0.10)] transition-all duration-300 overflow-hidden">
            {/* Image */}
            <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                {item.image_main_url ? (
                    <Image
                        src={item.image_main_url}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package2 className="w-12 h-12 text-neutral-200" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-4 flex flex-col gap-2 flex-1">
                {item.brand_name && (
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{item.brand_name}</span>
                )}
                <h2 className="text-[13.5px] font-semibold text-neutral-900 line-clamp-2 leading-snug group-hover:text-[#2E7A96] transition-colors">
                    {item.name}
                </h2>
                <p className="text-[12px] text-neutral-400">SKU: {item.sku}</p>
                <div className="mt-auto pt-2 border-t border-neutral-50">
                    <p className="text-[15px] font-bold text-[#2E7A96]">
                        {item.price ? formatPrice(item.price) : (item.price_display ?? 'Liên hệ báo giá')}
                    </p>
                </div>
            </div>
        </Link>
    )
}

// ── Inline Search Form (client-side redirect) ─────────────────────────────────
function SearchForm({ defaultValue }: { defaultValue: string }) {
    return (
        <form method="GET" action="/tim-kiem" className="flex gap-2 max-w-xl w-full">
            <div className="flex-1 flex items-center h-11 rounded-xl border border-neutral-200 bg-white px-4 gap-2 focus-within:border-[#2E7A96] focus-within:shadow-[0_0_0_3px_rgba(46,122,150,0.12)] transition-all">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                    name="q"
                    defaultValue={defaultValue}
                    placeholder="Nhập từ khóa tìm kiếm..."
                    className="flex-1 text-[14px] outline-none bg-transparent"
                    autoComplete="off"
                />
            </div>
            <button type="submit" className="h-11 px-5 bg-[#2E7A96] hover:bg-[#25617a] text-white text-[14px] font-medium rounded-xl transition-colors shrink-0">
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
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <nav className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
                    <Link href="/" className="hover:text-neutral-600 transition-colors">Trang chủ</Link>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span className="text-neutral-900">Tìm kiếm</span>
                </nav>
                <h1 className="text-2xl font-bold text-neutral-900 mb-4">
                    {query
                        ? <>Kết quả cho <span className="text-[#2E7A96]">"{query}"</span></>
                        : 'Tìm kiếm sản phẩm'
                    }
                </h1>
                <SearchForm defaultValue={query} />
            </div>

            {/* No query yet */}
            {!query && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
                        <Search className="w-9 h-9 text-neutral-300" />
                    </div>
                    <p className="text-xl font-semibold text-neutral-700 mb-2">Nhập từ khóa để bắt đầu tìm kiếm</p>
                    <p className="text-neutral-400 text-sm max-w-sm">
                        Thử tìm tên sản phẩm, mã SKU, hoặc tên thương hiệu như "TOTO", "HCG", "Hafele"...
                    </p>
                </div>
            )}

            {/* Results */}
            {data && (
                <>
                    {/* Stats */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-[14px] text-neutral-500">
                            {data.total > 0
                                ? <>Tìm thấy <strong className="text-neutral-900">{data.total.toLocaleString('vi-VN')}</strong> sản phẩm</>
                                : 'Không tìm thấy sản phẩm nào'
                            }
                        </p>
                    </div>

                    {/* Grid */}
                    {data.results.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {data.results.map(item => (
                                <ProductCard key={item.id} item={item} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
                                <Package2 className="w-9 h-9 text-neutral-300" />
                            </div>
                            <p className="text-xl font-semibold text-neutral-700 mb-2">Không có kết quả</p>
                            <p className="text-neutral-400 text-sm max-w-xs">
                                Không tìm thấy sản phẩm nào cho "{query}". Hãy thử từ khóa khác.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-6 justify-center">
                                {['TOTO', 'HCG', 'CAESAR', 'Hafele', 'Gạch ốp lát'].map(s => (
                                    <Link key={s} href={`/tim-kiem?q=${encodeURIComponent(s)}`} className="px-3 py-1.5 text-[13px] font-medium bg-neutral-100 text-neutral-700 rounded-full hover:bg-[#EAF6FB] hover:text-[#2E7A96] transition-colors">
                                        {s}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-10 flex-wrap">
                            {page > 1 && (
                                <Link href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${page - 1}`} className="px-4 py-2 rounded-lg border border-neutral-200 text-[14px] font-medium hover:border-[#2E7A96] hover:text-[#2E7A96] transition-colors">
                                    ← Trước
                                </Link>
                            )}
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                const p = i + 1
                                return (
                                    <Link
                                        key={p}
                                        href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${p}`}
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-[14px] font-medium transition-colors ${p === page ? 'bg-[#2E7A96] text-white' : 'border border-neutral-200 hover:border-[#2E7A96] hover:text-[#2E7A96]'}`}
                                    >
                                        {p}
                                    </Link>
                                )
                            })}
                            {page < totalPages && (
                                <Link href={`/tim-kiem?q=${encodeURIComponent(query)}&page=${page + 1}`} className="px-4 py-2 rounded-lg border border-neutral-200 text-[14px] font-medium hover:border-[#2E7A96] hover:text-[#2E7A96] transition-colors">
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
