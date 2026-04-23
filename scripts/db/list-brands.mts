import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase.from('brands').select('id, name, slug').order('name')
  if (error) {
    console.error(error)
    return
  }
  console.log(`Total brands: ${data.length}`)
  console.log(data.map(b => `- ${b.name} (${b.slug})`).join('\n'))
}
main()
