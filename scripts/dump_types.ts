import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.products.groupBy({
    by: ['category_id', 'subcategory_id', 'product_type', 'product_sub_type'],
    where: { is_active: true }
  })

  // We need names for cat/subcat
  const catMap = new Map()
  const subMap = new Map()

  const cats = await prisma.categories.findMany()
  for (const c of cats) catMap.set(c.id, c.name)

  const subs = await prisma.subcategories.findMany()
  for (const s of subs) subMap.set(s.id, s.name)

  const tree: any = {}
  
  for (const r of result) {
    const cName = catMap.get(r.category_id) || 'Unknown Category'
    const sName = r.subcategory_id ? subMap.get(r.subcategory_id) || 'Unknown Sub' : '(No Subcategory)'
    const pType = r.product_type || '(No Type)'
    const pSubType = r.product_sub_type || '(No SubType)'

    if (!tree[cName]) tree[cName] = {}
    if (!tree[cName][sName]) tree[cName][sName] = {}
    if (!tree[cName][sName][pType]) tree[cName][sName][pType] = new Set()
    
    tree[cName][sName][pType].add(pSubType)
  }

  for (const [cName, sObj] of Object.entries(tree)) {
    console.log(`- [Cấp 1] ${cName}`)
    for (const [sName, typeObj] of Object.entries(sObj as any)) {
      console.log(`  └─ [Cấp 2] ${sName}`)
      for (const [pType, subTypeSet] of Object.entries(typeObj as any)) {
        if (pType !== '(No Type)') {
          console.log(`      └─ [Cấp 3 - Type] ${pType}`)
          for (const pSubType of (subTypeSet as any)) {
            if (pSubType !== '(No SubType)') {
              console.log(`          └─ [Cấp 4 - SubType] ${pSubType}`)
            }
          }
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
