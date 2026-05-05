const fs = require('fs')
const path = require('path')

const filesToUpdate = [
    'src/lib/public-api-products.ts',
    'src/app/api/search/route.ts',
]

for (const file of filesToUpdate) {
    const fullPath = path.join(__dirname, file)
    let content = fs.readFileSync(fullPath, 'utf8')
    
    // In types
    content = content.replace(/is_new\??: boolean/g, 'is_promotion?: boolean')
    content = content.replace(/is_bestseller\??: boolean\n/g, '')
    
    // In destructuring/variables
    content = content.replace(/is_new,/g, 'is_promotion,')
    content = content.replace(/\s*is_bestseller,\n/g, '\n')
    
    // In conditional adding to where clause
    content = content.replace(/\.\.\.\(is_new !== undefined && \{ is_new \}\),/g, '...(is_promotion !== undefined && { is_promotion }),')
    content = content.replace(/\s*\.\.\.\(is_bestseller !== undefined && \{ is_bestseller \}\),\n/g, '\n')
    
    // In orderBy
    content = content.replace(/is_bestseller/g, 'is_promotion')
    
    // In select fields
    content = content.replace(/is_new: true,/g, 'is_promotion: true,')
    content = content.replace(/\s*is_bestseller: true,\n/g, '\n')
    
    // In where fields
    content = content.replace(/is_new: true/g, 'is_promotion: true')
    content = content.replace(/is_bestseller: true/g, 'is_promotion: true')

    fs.writeFileSync(fullPath, content)
}
console.log('Fixed files')
