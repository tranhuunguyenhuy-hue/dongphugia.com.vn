import { Client } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  await client.connect()
  
  try {
    const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['products'])
    console.log("Columns in products:", res.rows.map(r => r.column_name))

    const updateRes = await client.query(`
      UPDATE products 
      SET original_price = price * 1.25 
      WHERE is_featured = true AND price IS NOT NULL 
      LIMIT 1 
      RETURNING *
    `)
    console.log("Update success:", updateRes.rows)
  } catch (err) {
    console.error("SQL Error:", err)
  } finally {
    await client.end()
  }
}
main()
