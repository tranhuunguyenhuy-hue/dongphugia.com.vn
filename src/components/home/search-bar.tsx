'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowRight, Package2, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'

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

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState<T>(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debounced
}

export function SearchBar({ onExpandedChange }: { onExpandedChange?: (expanded: boolean) => void }) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const debouncedQuery = useDebounce(query, 280)

    useEffect(() => {
        onExpandedChange?.(isExpanded)
    }, [isExpanded, onExpandedChange])

    // Fetch autocomplete results
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults([])
            setTotal(0)
            setIsOpen(false)
            return
        }

        const controller = new AbortController()
        setIsLoading(true)

        fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`, {
            signal: controller.signal,
        })
            .then(r => r.json())
            .then(data => {
                setResults(data.results ?? [])
                setTotal(data.total ?? 0)
                setIsOpen(true)
            })
            .catch(() => { })
            .finally(() => setIsLoading(false))

        return () => controller.abort()
    }, [debouncedQuery])

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
                setIsExpanded(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim().length < 1) return
        setIsOpen(false)
        router.push(`/tim-kiem?q=${encodeURIComponent(query.trim())}`)
    }, [query, router])

    const handleResultClick = useCallback((url: string) => {
        setIsOpen(false)
        setQuery('')
        router.push(url)
    }, [router])

    const handleClear = useCallback(() => {
        setQuery('')
        setResults([])
        setIsOpen(false)
        inputRef.current?.focus()
    }, [])

    return (
        <div ref={containerRef} className="relative w-11 h-11 shrink-0 z-50">
            {/* Absolute overlay that expands to the left without pushing siblings */}
            <form onSubmit={handleSubmit} className={`absolute right-0 top-0 transition-all duration-300 ease-out origin-right ${isExpanded ? 'w-[360px] xl:w-[420px]' : 'w-11'} shrink-0 z-50`}>
                <div 
                    className={`flex items-center h-11 rounded-full transition-all duration-300 overflow-hidden border ${isExpanded ? (isOpen ? 'bg-white border-brand-500 shadow-[0_0_0_3px_rgba(46,122,150,0.12)]' : 'bg-stone-50 border-stone-200 hover:bg-stone-100') : 'bg-transparent border-transparent cursor-pointer hover:bg-brand-50'}`}
                    onClick={() => {
                        if (!isExpanded) {
                            setIsExpanded(true)
                            setTimeout(() => inputRef.current?.focus(), 100)
                        }
                    }}
                >
                    {/* Search Icon */}
                    <button 
                        type={isExpanded ? 'submit' : 'button'}
                        className={`w-11 h-11 flex items-center justify-center shrink-0 transition-colors ${isExpanded ? '' : 'text-stone-700 hover:text-brand-600'}`}
                    >
                        {isLoading
                            ? <Loader2 className="w-[18px] h-[18px] text-brand-600 animate-spin" />
                            : <Search className={`w-[18px] h-[18px] ${isExpanded ? 'text-stone-500' : 'text-current'}`} strokeWidth={2} />
                        }
                    </button>

                    {/* Input */}
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onFocus={() => {
                            if (!isExpanded) setIsExpanded(true);
                            if (results.length > 0) setIsOpen(true);
                        }}
                        placeholder="Tìm kiếm..."
                        className={`flex-1 h-full bg-transparent text-[14px] text-stone-900 placeholder:text-stone-500 outline-none transition-opacity duration-200 ${isExpanded ? 'opacity-100 min-w-[200px]' : 'opacity-0 w-0'}`}
                        autoComplete="off"
                        spellCheck={false}
                        tabIndex={isExpanded ? 0 : -1}
                    />

                    {/* Clear */}
                    {query && isExpanded && (
                        <button type="button" onClick={handleClear} className="pr-4 pl-2 flex items-center text-stone-400 hover:text-stone-600 transition-colors shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </form>

            <div className={`fixed inset-0 bg-stone-900/10 backdrop-blur-[2px] z-40 transition-opacity duration-300 pointer-events-none ${isExpanded ? 'opacity-100' : 'opacity-0'}`} />

            {/* Autocomplete Dropdown */}
            {isOpen && results.length > 0 && (
                <div className="absolute top-[calc(100%+8px)] left-0 min-w-full w-[360px] xl:w-[420px] bg-white rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-stone-200 z-[60] overflow-hidden">
                    {/* Results list */}
                    <div className="py-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {results.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleResultClick(item.url)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors text-left group"
                            >
                                {/* Image */}
                                <div className="w-11 h-11 rounded-[10px] bg-stone-100 border border-stone-100 overflow-hidden shrink-0 flex items-center justify-center">
                                    {item.image_main_url ? (
                                        <Image
                                            src={item.image_main_url}
                                            alt={item.name}
                                            width={44}
                                            height={44}
                                            className="object-cover w-full h-full mix-blend-multiply"
                                        />
                                    ) : (
                                        <Package2 className="w-5 h-5 text-stone-300" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13.5px] font-medium text-stone-900 line-clamp-1 group-hover:text-brand-600 transition-colors">
                                        {item.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {item.brand_name && (
                                            <span className="text-[11px] text-stone-500 font-medium">{item.brand_name}</span>
                                        )}
                                        {item.brand_name && <span className="text-[10px] text-stone-300">·</span>}
                                        <span className="text-[11px] text-stone-400">SKU: {item.sku}</span>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="shrink-0 text-right pl-2">
                                    <span className="text-[13px] font-bold text-brand-600">
                                        {item.price ? formatPrice(item.price) : (item.price_display ?? 'Liên hệ')}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Footer: Xem tất cả */}
                    {total > results.length && (
                        <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/50">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false)
                                    router.push(`/tim-kiem?q=${encodeURIComponent(query)}`)
                                }}
                                className="flex items-center gap-2 text-[13px] text-brand-600 font-medium hover:underline"
                            >
                                Xem tất cả {total.toLocaleString('vi-VN')} kết quả <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* No results */}
            {isOpen && !isLoading && query.length >= 2 && results.length === 0 && (
                <div className="absolute top-[calc(100%+8px)] left-0 min-w-full w-[360px] xl:w-[420px] bg-white rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-stone-200 z-[60] px-6 py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-stone-50 flex items-center justify-center mx-auto mb-4">
                        <Search className="w-6 h-6 text-stone-300" />
                    </div>
                    <p className="text-[14px] font-medium text-stone-700">Không tìm thấy sản phẩm nào</p>
                    <p className="text-[13px] text-stone-500 mt-1">Hãy thử từ khóa khác hoặc tìm theo mã SKU</p>
                </div>
            )}
        </div>
    )
}
