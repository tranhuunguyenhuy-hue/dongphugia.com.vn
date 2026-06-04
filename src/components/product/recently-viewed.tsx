'use client';

import { useEffect, useState } from 'react';
import { useRecentlyViewedStore, RecentlyViewedProduct } from '@/store/useRecentlyViewedStore';
import { ProductCard } from '@/components/ui/product-card';

export function RecentlyViewedProducts({ currentProduct }: { currentProduct?: RecentlyViewedProduct }) {
    const [mounted, setMounted] = useState(false);
    const { products, addProduct } = useRecentlyViewedStore();

    useEffect(() => {
        setMounted(true);
        if (currentProduct && currentProduct.id) {
            addProduct(currentProduct);
        }
    }, [currentProduct, addProduct]);

    if (!mounted) return null;

    const currentProductId = currentProduct?.id;
    const currentCategorySlug = currentProduct?.category_slug;
    const displayProducts = products
        .filter(p => p.id !== currentProductId && p.category_slug === currentCategorySlug)
        .slice(0, 4); // Display max 4

    if (displayProducts.length === 0) return null;

    return (
        <div className="mt-16 pt-8 border-t border-stone-100">
            <h2 className="text-display-xs font-bold text-stone-900 mb-6">Sản phẩm vừa xem</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {displayProducts.map((product) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        href={product.url}
                    />
                ))}
            </div>
        </div>
    );
}
