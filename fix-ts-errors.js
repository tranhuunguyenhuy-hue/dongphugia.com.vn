const fs = require('fs')
const path = require('path')

const fileChanges = [
    // 1. Remove duplicate is_promotion keys in src/lib/public-api-products.ts
    {
        file: 'src/lib/public-api-products.ts',
        replacements: [
            { search: /is_promotion: true,\s*is_promotion: true/g, replace: 'is_promotion: true' },
            { search: /is_promotion: true,\n\s*is_promotion: true/g, replace: 'is_promotion: true' },
            { search: /is_promotion: true,\s*\n\s*is_promotion: true/g, replace: 'is_promotion: true' },
            { search: /where: \{ is_active: true, is_promotion: true \},/g, replace: 'where: { is_active: true, is_promotion: true },' },
        ]
    },
    // 2. Fix admin-product-queries.ts
    {
        file: 'src/lib/admin-product-queries.ts',
        replacements: [
            { search: /is_new: true,/g, replace: 'is_promotion: true,' },
            { search: /is_bestseller: true,/g, replace: '' }
        ]
    },
    // 3. Fix featured-products-client.ts and featured-categories.tsx
    {
        file: 'src/components/home/featured-products-client.tsx',
        replacements: [
            { search: /is_new: boolean/g, replace: 'is_promotion: boolean' },
            { search: /is_bestseller: boolean\n/g, replace: '' },
            { search: /is_new: boolean\s*\||\s*undefined;/g, replace: 'is_promotion: boolean;' },
            { search: /is_bestseller: boolean\s*\||\s*undefined;/g, replace: '' }
        ]
    },
    {
        file: 'src/components/home/featured-categories.tsx',
        replacements: [
            { search: /is_new: p\.is_new,/g, replace: 'is_promotion: p.is_promotion,' },
            { search: /is_bestseller: p\.is_bestseller,/g, replace: '' }
        ]
    },
    // 4. Fix PDP pages (gach-op-lat, thiet-bi-bep, vv)
    {
        file: 'src/app/(public)/gach-op-lat/[sub]/[slug]/page.tsx',
        replacements: [
            { search: /\{product\.is_new && \(\s*<Badge className="text-\[10px\] px-1\.5 py-0 bg-purple-100 text-purple-700 hover:bg-purple-100">\s*Mới\s*<\/Badge>\s*\)\}/g, replace: '' },
            { search: /\{product\.is_bestseller && \(\s*<Badge className="text-\[10px\] px-1\.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">\s*Bán chạy\s*<\/Badge>\s*\)\}/g, replace: '' },
            { search: /\{product\.is_new &&/g, replace: '{(product.is_promotion || (product.original_price && product.original_price > (product.price || 0))) &&' },
            { search: /\{product\.is_bestseller &&/g, replace: '{false &&' } // Lazy way
        ]
    },
    {
        file: 'src/app/(public)/thiet-bi-bep/[sub]/[slug]/page.tsx',
        replacements: [
            { search: /\{product\.is_new &&/g, replace: '{(product.is_promotion || (product.original_price && product.original_price > (product.price || 0))) &&' },
            { search: /\{product\.is_bestseller &&/g, replace: '{false &&' }
        ]
    },
    {
        file: 'src/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page.tsx',
        replacements: [
            { search: /\{product\.is_new &&/g, replace: '{(product.is_promotion || (product.original_price && product.original_price > (product.price || 0))) &&' },
            { search: /\{product\.is_bestseller &&/g, replace: '{false &&' }
        ]
    },
    {
        file: 'src/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page.tsx',
        replacements: [
            { search: /\{product\.is_new &&/g, replace: '{(product.is_promotion || (product.original_price && product.original_price > (product.price || 0))) &&' },
            { search: /\{product\.is_bestseller &&/g, replace: '{false &&' }
        ]
    },
    // 5. Fix PLP pages (gach-op-lat, thiet-bi-bep, vv)
    {
        file: 'src/app/(public)/gach-op-lat/[sub]/page.tsx',
        replacements: [
            { search: /is_new: isNew \? true : undefined,/g, replace: 'is_promotion: isNew ? true : undefined,' }
        ]
    },
    {
        file: 'src/app/(public)/thiet-bi-bep/[sub]/page.tsx',
        replacements: [
            { search: /is_new: isNew \? true : undefined,/g, replace: 'is_promotion: isNew ? true : undefined,' }
        ]
    },
    {
        file: 'src/app/(public)/thiet-bi-ve-sinh/[sub]/page.tsx',
        replacements: [
            { search: /is_new: isNew \? true : undefined,/g, replace: 'is_promotion: isNew ? true : undefined,' }
        ]
    },
    {
        file: 'src/app/(public)/vat-lieu-nuoc/[sub]/page.tsx',
        replacements: [
            { search: /is_new: isNew \? true : undefined,/g, replace: 'is_promotion: isNew ? true : undefined,' }
        ]
    }
]

for (const change of fileChanges) {
    const fullPath = path.join(__dirname, change.file)
    if (!fs.existsSync(fullPath)) continue;
    let content = fs.readFileSync(fullPath, 'utf8')
    for (const rep of change.replacements) {
        content = content.replace(rep.search, rep.replace)
    }
    fs.writeFileSync(fullPath, content)
}
console.log('Fixed typescript errors')
