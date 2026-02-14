'use client'

import { useState } from "react"
import { Category, Brand, ProductType, Product } from "@prisma/client"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { BrandManager } from "./brand-manager"
import { ProductList } from "./product-list"
import { ProductDialog } from "./product-dialog"

// Extend types manually since Prisma client might not be fully updated in types
type ExtendedCategory = Category & {
    brands: Brand[]
    productTypes: (ProductType & { productGroups: any[] })[]
    products: (Product & { brand: Brand; productType: ProductType; productGroup: any | null })[]
}

interface CategoryClientProps {
    category: any // Use any to bypass strict type checks for now due to schema lag
}

export function CategoryClient({ category }: CategoryClientProps) {
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<any>(null)

    const handleCreateProduct = () => {
        setEditingProduct(null)
        setIsProductDialogOpen(true)
    }

    const handleEditProduct = (product: any) => {
        setEditingProduct(product)
        setIsProductDialogOpen(true)
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{category.name} ({category.products.length})</h2>
                    <p className="text-sm text-muted-foreground">Quản lý sản phẩm, thương hiệu và thuộc tính</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleCreateProduct} className="press-effect">
                        <Plus className="mr-2 h-4 w-4" /> Thêm Sản Phẩm
                    </Button>
                </div>
            </div>
            <Separator />

            <Tabs defaultValue="products" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="products">Sản phẩm</TabsTrigger>
                    <TabsTrigger value="brands">Thương hiệu</TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="space-y-4">
                    <ProductList
                        products={category.products}
                        brands={category.brands}
                        productTypes={category.productTypes}
                        onEdit={handleEditProduct}
                    />
                </TabsContent>

                <TabsContent value="brands" className="space-y-4">
                    <Card className="p-6">
                        <BrandManager
                            brands={category.brands}
                            categoryId={category.id}
                        />
                    </Card>
                </TabsContent>
            </Tabs>

            <ProductDialog
                open={isProductDialogOpen}
                onOpenChange={setIsProductDialogOpen}
                product={editingProduct}
                brands={category.brands}
                productTypes={category.productTypes}
                categoryId={category.id}
            />
        </>
    )
}
