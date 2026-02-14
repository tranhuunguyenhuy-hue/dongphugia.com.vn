'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { SidebarShell } from '@/components/ui/sidebar-shell';

interface ProductType {
    id: string;
    name: string;
    slug: string;
    image: string | null;
}

interface Category {
    id: string;
    name: string;
    slug: string;
    productTypes: ProductType[];
}

interface CategoryMegaMenuProps {
    categories: Category[];
}

export function CategoryMegaMenu({ categories }: CategoryMegaMenuProps) {
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

    const activeCategory = categories.find((c) => c.id === activeCategoryId);

    return (
        <div
            className="group/sidebar w-[302px] shrink-0 relative z-20"
            onMouseLeave={() => setActiveCategoryId(null)}
        >
            <SidebarShell title="Danh mục sản phẩm" className="w-full">
                {categories.map((cat) => (
                    <div
                        key={cat.id}
                        onMouseEnter={() => setActiveCategoryId(cat.id)}
                        className="relative"
                    >
                        <Link
                            href={`/danh-muc/${cat.slug}`}
                            className={`
                                flex items-center justify-between px-5 py-3
                                transition-colors
                                ${activeCategoryId === cat.id
                                    ? 'bg-[#f0fdf4] text-[#15803d]'
                                    : 'text-[#4b5563] hover:bg-gray-50 hover:text-[#111827]'
                                }
                            `}
                        >
                            <span className="font-semibold text-[15px] leading-[24px]">
                                {cat.name}
                            </span>
                            <ChevronRight
                                className={`h-5 w-5 transition-opacity ${activeCategoryId === cat.id ? 'opacity-100' : 'opacity-40'
                                    }`}
                            />
                        </Link>
                    </div>
                ))}

                {/* Fallback/Extra decorative spacing if needed */}
                {categories.length === 0 && (
                    <div className="p-5 text-gray-400 text-sm text-center">
                        Đang cập nhật...
                    </div>
                )}
            </SidebarShell>

            {/* Mega Menu Panel - Absolute positioned to the right */}
            {activeCategory && activeCategory.productTypes.length > 0 && (
                <div
                    className="absolute top-0 left-[310px] w-[800px] min-h-[400px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 animate-in fade-in slide-in-from-left-2 duration-200"
                    style={{ zIndex: 100 }}
                >
                    <div className="flex flex-col gap-6">
                        {/* Title */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <h3 className="font-bold text-[20px] text-[#111827]">
                                Loại {activeCategory.name}
                            </h3>
                            <Link
                                href={`/danh-muc/${activeCategory.slug}`}
                                className="text-sm font-medium text-[#16a34a] hover:underline"
                            >
                                Xem tất cả
                            </Link>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            {activeCategory.productTypes.map((pt) => (
                                <Link
                                    key={pt.id}
                                    href={`/danh-muc/${activeCategory.slug}?productType=${pt.id}`}
                                    className="group flex flex-col gap-2 items-center text-center p-2 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    {/* Image Thumbnail */}
                                    <div className="w-[120px] h-[120px] rounded-[16px] overflow-hidden bg-gray-100 border border-gray-100 shadow-sm group-hover:shadow-md transition-all">
                                        {pt.image ? (
                                            <Image
                                                src={pt.image}
                                                alt={pt.name}
                                                width={120}
                                                height={120}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                                                No Image
                                            </div>
                                        )}
                                    </div>

                                    {/* Name */}
                                    <span className="font-medium text-[14px] text-[#374151] group-hover:text-[#16a34a] transition-colors line-clamp-2">
                                        {pt.name}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
