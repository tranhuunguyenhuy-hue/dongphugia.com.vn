import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'URL' // we need to parse from .env.local
import fs from 'fs'
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) env[match[1]] = match[2].trim()
})

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

async function run() {
  const { data: categories } = await supabase.from('categories').select('*')
  console.log('Categories:', categories?.length || 'table not found')
  
  const { data: subcats } = await supabase.from('subcategories').select('*')
  console.log('Subcategories:', subcats?.length || 'table not found')
  if (subcats) {
    const grouped = {}
    subcats.forEach(s => {
      grouped[s.category_id] = (grouped[s.category_id] || 0) + 1
    })
    console.log('Subcats grouped by category_id:', grouped)
    console.log('Sample subcats:', subcats.slice(0, 5))
  }
  
  const { data: brands } = await supabase.from('brands').select('id, name')
  console.log('Brands:', brands?.length || 'table not found')
  if (brands) {
    console.log(brands.map(b => b.name).join(', '))
  }
}
run()
