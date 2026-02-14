
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { ProductCard } from '@/components/ui/product-card';

interface ProductSectionProps {
    title: string;
    products: any[];
    categorySlug?: string;
}

export function ProductSection({ title, products, categorySlug }: ProductSectionProps) {
    if (!products || products.length === 0) return null;

    return (
        <section className="flex flex-col gap-12 w-full pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h2 className="text-[32px] font-semibold tracking-tight text-gray-900">
                    Sản phẩm <span className="text-[#15803d] font-bold">{title}</span>
                </h2>

                {/* Filters */}
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2 rounded-xl text-gray-900 border-gray-300">
                        Danh mục <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="gap-2 rounded-xl text-gray-900 border-gray-300">
                        Thương hiệu <ChevronDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Grid - 5 cols x 2 rows */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-16">
                {products.slice(0, 10).map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>

            {/* View All Button */}
            <div className="flex justify-center">
                <Button
                    asChild
                    variant="outline"
                    className="border-[#22c55e] text-[#15803d] bg-[#f0fdf4] hover:bg-[#dcfce7] rounded-xl px-10 py-6 text-base font-medium h-auto"
                >
                    <Link href={categorySlug ? `/danh-muc/${categorySlug}` : '/san-pham'}>
                        Xem toàn bộ sản phẩm
                    </Link>
                </Button>
            </div>
        </section>
    )
}
