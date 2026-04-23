import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  // Query product_categories
  const { data: categories, error: catError } = await supabase.from('product_categories').select('id, name, slug').order('sort_order')
  
  if (catError) {
    console.error('Error fetching categories:', catError)
    
    // Try 'categories' if 'product_categories' doesn't exist
    const { data: categoriesAlt, error: catAltError } = await supabase.from('categories').select('id, name, slug')
    if (catAltError) {
      console.error('Error fetching categories alt:', catAltError)
      return
    }
    await printCategories(categoriesAlt)
    return
  }
  
  await printCategories(categories)
}

async function printCategories(categories: any[]) {
  console.log(`Total Categories: ${categories.length}`)
  let totalSubCatCount = 0;
  
  for (const cat of categories) {
    // Try product_types
    const { data: productTypes, error: ptError } = await supabase.from('product_types').select('id, name, slug').eq('category_id', cat.id)
    
    if (ptError) {
      console.error(`Error fetching product_types for ${cat.name}:`, ptError)
      continue
    }
    
    console.log(`\n📂 ${cat.name} (${cat.slug}) - ${productTypes.length} Subcategories:`)
    totalSubCatCount += productTypes.length;
    
    for (const pt of productTypes) {
       console.log(`   - ${pt.name} (${pt.slug})`)
    }
  }
  console.log(`\n=> Tổng cộng: ${totalSubCatCount} subcategories trên toàn hệ thống cần làm thumbnail.`)
}

main()
