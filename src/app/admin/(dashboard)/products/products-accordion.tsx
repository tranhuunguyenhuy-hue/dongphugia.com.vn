'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
    ChevronDown,
    ChevronRight,
    Pencil,
    Trash2,
    Plus,
    Search,
    FolderOpen,
    Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteProduct, deleteCollection } from '@/lib/actions'
import { toast } from 'sonner'
import { CollectionModal, type CollectionModalData } from './collection-modal'

// --- Types ---
type ProductRow = {
    id: number
    sku: string
    name: string
    is_active: boolean
    sizes: { label: string } | null
    surfaces: { name: string } | null
}

type CollectionItem = {
    id: number
    name: string
    slug: string
    thumbnail_url: string | null
    pattern_type_id: number
    tagline: string | null
    is_active: boolean
    is_featured: boolean
    sort_order: number
    products: ProductRow[]
}

type PatternType = { id: number; name: string }

interface Props {
    collections: CollectionItem[]
    unassignedProducts: ProductRow[]
    patternTypes: PatternType[]
    patternFilter?: number
}

// --- ProductTable ---
function ProductTable({ products, searchTerm }: { products: ProductRow[]; searchTerm: string }) {
    if (products.length === 0) {
        return (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Chưa có sản phẩm nào
            </p>
        )
    }
    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-[#E4EEF2] bg-[#F5F9FB]">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#3C4E56] w-[130px]">SKU</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#3C4E56]">Tên sản phẩm</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#3C4E56] hidden sm:table-cell w-[110px]">Kích thước</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#3C4E56] hidden md:table-cell w-[80px]">Bề mặt</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#3C4E56] w-[80px]">Trạng thái</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#3C4E56] w-[80px]">Thao tác</th>
                </tr>
            </thead>
            <tbody>
                {products.map((p) => (
                    <ProductRowItem key={p.id} product={p} searchTerm={searchTerm} />
                ))}
            </tbody>
        </table>
    )
}

// --- ProductRowItem ---
function ProductRowItem({ product, searchTerm }: { product: ProductRow; searchTerm: string }) {
    const [isDeleting, startTransition] = useTransition()

    const handleDelete = () => {
        if (!confirm(`Xóa sản phẩm "${product.name}"?`)) return
        startTransition(async () => {
            const result = await deleteProduct(product.id)
            if (result.success) toast.success('Đã xóa sản phẩm')
            else toast.error(result.message || 'Có lỗi xảy ra')
        })
    }

    const highlight = (text: string) => {
        if (!searchTerm || !text.toLowerCase().includes(searchTerm)) return text
        const idx = text.toLowerCase().indexOf(searchTerm)
        return (
            <>
                {text.slice(0, idx)}
                <mark className="bg-yellow-100 rounded px-0.5">{text.slice(idx, idx + searchTerm.length)}</mark>
                {text.slice(idx + searchTerm.length)}
            </>
        )
    }

    return (
        <tr className="border-b border-[#E4EEF2] last:border-0 hover:bg-[#F5F9FB] transition-colors">
            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {highlight(product.sku)}
            </td>
            <td className="px-4 py-2.5 font-medium text-[#192125] text-sm">
                {highlight(product.name)}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground text-sm hidden sm:table-cell">
                {product.sizes?.label || '—'}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground text-sm hidden md:table-cell">
                {product.surfaces?.name || '—'}
            </td>
            <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {product.is_active ? 'Hiện' : 'Ẩn'}
                </span>
            </td>
            <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-1">
                    <Link
                        href={`/admin/products/${product.id}`}
                        className="h-7 w-7 rounded-lg border border-[#E4EEF2] flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        title="Sửa sản phẩm"
                    >
                        <Pencil className="h-3 w-3" />
                    </Link>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="h-7 w-7 rounded-lg border border-[#E4EEF2] flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                        title="Xóa sản phẩm"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            </td>
        </tr>
    )
}

// --- CollectionAccordionItem ---
function CollectionAccordionItem({
    collection,
    isExpanded,
    onToggle,
    onEdit,
    searchTerm,
}: {
    collection: CollectionItem
    isExpanded: boolean
    onToggle: () => void
    onEdit: () => void
    searchTerm: string
}) {
    const [isDeleting, startDeleteTransition] = useTransition()

    const handleDelete = () => {
        if (!confirm(`Xóa bộ sưu tập "${collection.name}"?\nSản phẩm bên trong sẽ được chuyển về "Chưa phân loại".`)) return
        startDeleteTransition(async () => {
            const result = await deleteCollection(collection.id)
            if (result.success) toast.success('Đã xóa bộ sưu tập')
            else toast.error(result.message || 'Có lỗi xảy ra')
        })
    }

    return (
        <div className="bg-white rounded-2xl border border-[#E4EEF2] overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F5F9FB] transition-colors select-none"
                onClick={onToggle}
            >
                <div className="shrink-0 text-muted-foreground">
                    {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                </div>

                {collection.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={collection.thumbnail_url}
                        alt={collection.name}
                        className="h-10 w-10 rounded-lg object-cover shrink-0 border border-[#E4EEF2]"
                    />
                ) : (
                    <div className="h-10 w-10 rounded-lg bg-[#EAF6FB] flex items-center justify-center shrink-0 border border-[#E4EEF2]">
                        <Package className="h-4 w-4 text-primary/60" />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#192125] truncate">{collection.name}</p>
                    {collection.tagline && (
                        <p className="text-xs text-muted-foreground truncate">{collection.tagline}</p>
                    )}
                </div>

                <span className="text-sm text-muted-foreground shrink-0 mr-2">
                    {collection.products.length} sản phẩm
                </span>

                {/* Actions — stop propagation so clicks don't toggle accordion */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={onEdit}
                        className="h-7 w-7 rounded-lg border border-[#E4EEF2] flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        title="Sửa bộ sưu tập"
                    >
                        <Pencil className="h-3 w-3" />
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="h-7 w-7 rounded-lg border border-[#E4EEF2] flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                        title="Xóa bộ sưu tập"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <div className="border-t border-[#E4EEF2]">
                    <ProductTable products={collection.products} searchTerm={searchTerm} />
                    <div className="px-4 py-2.5 border-t border-[#E4EEF2] flex justify-end">
                        <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary gap-1.5 h-8 text-xs">
                            <Link href={`/admin/products/new`}>
                                <Plus className="h-3.5 w-3.5" />
                                Thêm sản phẩm vào BST
                            </Link>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- UnassignedAccordionItem ---
function UnassignedAccordionItem({
    products,
    isExpanded,
    onToggle,
    searchTerm,
}: {
    products: ProductRow[]
    isExpanded: boolean
    onToggle: () => void
    searchTerm: string
}) {
    return (
        <div className="bg-white rounded-2xl border border-dashed border-[#E4EEF2] overflow-hidden">
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F5F9FB] transition-colors select-none"
                onClick={onToggle}
            >
                <div className="shrink-0 text-muted-foreground">
                    {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                </div>
                <div className="h-10 w-10 rounded-lg bg-[#F5F9FB] flex items-center justify-center shrink-0 border border-[#E4EEF2]">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="flex-1 font-medium text-sm text-muted-foreground">
                    Sản phẩm chưa phân loại
                </p>
                <span className="text-sm text-muted-foreground shrink-0">
                    {products.length} sản phẩm
                </span>
            </div>

            {isExpanded && (
                <div className="border-t border-[#E4EEF2]">
                    <ProductTable products={products} searchTerm={searchTerm} />
                </div>
            )}
        </div>
    )
}

// --- Main Component ---
export function ProductsAccordion({ collections, unassignedProducts, patternTypes, patternFilter }: Props) {
    const [search, setSearch] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<number | 'unassigned'>>(new Set())
    const [modal, setModal] = useState<{ collection?: CollectionModalData } | null>(null)

    const searchTerm = search.toLowerCase().trim()

    // Filter by search
    const filteredCollections = useMemo(() => {
        if (!searchTerm) return collections
        return collections
            .map((col) => ({
                ...col,
                products: col.products.filter(
                    (p) =>
                        p.sku.toLowerCase().includes(searchTerm) ||
                        p.name.toLowerCase().includes(searchTerm)
                ),
            }))
            .filter((col) => col.products.length > 0)
    }, [collections, searchTerm])

    const filteredUnassigned = useMemo(() => {
        if (!searchTerm) return unassignedProducts
        return unassignedProducts.filter(
            (p) =>
                p.sku.toLowerCase().includes(searchTerm) ||
                p.name.toLowerCase().includes(searchTerm)
        )
    }, [unassignedProducts, searchTerm])

    // When searching, auto-expand all matching groups
    const effectiveExpandedIds = useMemo<Set<number | 'unassigned'>>(() => {
        if (!searchTerm) return expandedIds
        const expanded = new Set<number | 'unassigned'>()
        filteredCollections.forEach((col) => expanded.add(col.id))
        if (filteredUnassigned.length > 0) expanded.add('unassigned')
        return expanded
    }, [searchTerm, filteredCollections, filteredUnassigned, expandedIds])

    const toggleExpand = (id: number | 'unassigned') => {
        if (searchTerm) return // Search controls expand state
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const showUnassigned = searchTerm
        ? filteredUnassigned.length > 0
        : unassignedProducts.length > 0
    const unassignedList = searchTerm ? filteredUnassigned : unassignedProducts

    const isEmpty =
        filteredCollections.length === 0 &&
        (searchTerm ? filteredUnassigned.length === 0 : unassignedProducts.length === 0)

    return (
        <>
            {/* Search + Add BST */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        className="w-full h-10 pl-9 pr-4 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
                        placeholder="Tìm kiếm theo mã SP hoặc tên..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    className="gap-2 shrink-0"
                    onClick={() => setModal({})}
                >
                    <Plus className="h-4 w-4" />
                    Thêm BST mới
                </Button>
            </div>

            {/* Accordion list */}
            <div className="space-y-2">
                {filteredCollections.map((col) => (
                    <CollectionAccordionItem
                        key={col.id}
                        collection={col}
                        isExpanded={effectiveExpandedIds.has(col.id)}
                        onToggle={() => toggleExpand(col.id)}
                        onEdit={() => setModal({ collection: col })}
                        searchTerm={searchTerm}
                    />
                ))}

                {showUnassigned && (
                    <UnassignedAccordionItem
                        products={unassignedList}
                        isExpanded={effectiveExpandedIds.has('unassigned')}
                        onToggle={() => toggleExpand('unassigned')}
                        searchTerm={searchTerm}
                    />
                )}

                {isEmpty && (
                    <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-[#E4EEF2]">
                        {searchTerm
                            ? `Không tìm thấy sản phẩm với từ khoá "${search}"`
                            : 'Chưa có bộ sưu tập hay sản phẩm nào'}
                    </div>
                )}
            </div>

            {/* Collection Modal — key forces re-mount when switching create/edit */}
            {modal !== null && (
                <CollectionModal
                    key={modal.collection?.id ?? 'new'}
                    isOpen={true}
                    onClose={() => setModal(null)}
                    patternTypes={patternTypes}
                    collection={modal.collection}
                    defaultPatternTypeId={patternFilter}
                />
            )}
        </>
    )
}
