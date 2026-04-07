/**
 * test-bunny-connection.mjs — Quick Bunny CDN connection test
 * Usage: node scripts/product-import/test-bunny-connection.mjs
 */
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env.local') })

const zone = process.env.BUNNY_STORAGE_ZONE_NAME
const key  = process.env.BUNNY_STORAGE_API_KEY
const host = process.env.BUNNY_STORAGE_HOSTNAME
const cdn  = process.env.BUNNY_CDN_HOSTNAME

console.log('🐰 Bunny CDN Connection Test')
console.log('━'.repeat(40))
console.log('Zone :', zone || '❌ MISSING')
console.log('Host :', host || '❌ MISSING')
console.log('CDN  :', cdn  || '❌ MISSING')
console.log('Key  :', key  ? key.substring(0,8) + '...' : '❌ MISSING')
console.log('━'.repeat(40))

if (!zone || !key || !host || !cdn) {
  console.error('❌ Thiếu env vars. Kiểm tra .env.local')
  process.exit(1)
}

// Test 1: List storage root
process.stdout.write('\n[1/2] List Storage Zone... ')
const r1 = await fetch(`https://${host}/${zone}/`, {
  headers: { AccessKey: key, Accept: 'application/json' }
})
if (r1.status === 200) {
  console.log(`✅ OK (${r1.status})`)
} else {
  console.log(`❌ FAIL (${r1.status} ${r1.statusText})`)
  console.log('   →', await r1.text())
  process.exit(1)
}

// Test 2: Upload test file
process.stdout.write('[2/2] Upload test file... ')
const r2 = await fetch(`https://${host}/${zone}/__test__/dpg-ok.txt`, {
  method: 'PUT',
  headers: { AccessKey: key, 'Content-Type': 'text/plain' },
  body: `DPG Bunny CDN OK — ${new Date().toISOString()}`
})
if (r2.status === 201) {
  console.log(`✅ OK (${r2.status})`)
  console.log(`\n🎉 Bunny CDN hoạt động bình thường!`)
  console.log(`🔗 Test URL: https://${cdn}/__test__/dpg-ok.txt`)
} else {
  console.log(`❌ FAIL (${r2.status} ${r2.statusText})`)
  console.log('   →', await r2.text())
  process.exit(1)
}
