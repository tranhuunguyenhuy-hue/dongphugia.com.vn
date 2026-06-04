import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentlyViewedProduct {
    id: number;
    name: string;
    display_name?: string | null;
    slug: string;
    sku?: string | null;
    image_main_url?: string | null;
    price: number | null;
    original_price: number | null;
    online_discount_amount: number | null;
    price_display?: string | null;
    category_slug?: string;
    is_featured?: boolean;
    is_promotion?: boolean;
    url: string;
    colors?: any;
    brands?: any;
    subcategories?: any;
    stock_status?: string | null;
}

interface RecentlyViewedState {
    products: RecentlyViewedProduct[];
    addProduct: (product: RecentlyViewedProduct) => void;
    clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
    persist(
        (set) => ({
            products: [],
            addProduct: (product) => set((state) => {
                const existingIndex = state.products.findIndex((p) => p.id === product.id);
                if (existingIndex >= 0) {
                    const newProducts = [...state.products];
                    newProducts.splice(existingIndex, 1);
                    return { products: [product, ...newProducts] };
                }
                return {
                    products: [product, ...state.products].slice(0, 15), // keep last 15
                };
            }),
            clear: () => set({ products: [] }),
        }),
        {
            name: 'recently-viewed-storage',
        }
    )
);
