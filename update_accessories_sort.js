const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Finding target subcategories...')
    
    // Find subcategories that match accessories
    const targetKeywords = ['phụ kiện', 'thân bồn cầu']
    
    const allSubcategories = await prisma.subcategories.findMany()
    
    const targetSubcategories = allSubcategories.filter(sub => 
        targetKeywords.some(keyword => sub.name.toLowerCase().includes(keyword))
    )
    
    if (targetSubcategories.length === 0) {
        console.log('No matching subcategories found.')
        return
    }
    
    console.log('Found subcategories to push down:')
    targetSubcategories.forEach(sub => console.log(`- ${sub.name} (ID: ${sub.id})`))
    
    const subcategoryIds = targetSubcategories.map(s => s.id)
    
    // Update all products in these subcategories to sort_order 9999
    console.log('\nUpdating sort_order of related products to 9999...')
    const result = await prisma.products.updateMany({
        where: {
            subcategory_id: {
                in: subcategoryIds
            }
        },
        data: {
            sort_order: 9999
        }
    })
    
    console.log(`Successfully updated ${result.count} products!`)
}

main()
  .catch(e => {
      console.error(e)
      process.exit(1)
  })
  .finally(async () => {
      await prisma.$disconnect()
  })
