/**
 * Preview exported Excel file in terminal
 */
import XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const filePath = process.argv[2] || path.resolve(import.meta.dirname, '../output/products-export-2026-04-24.xlsx')

const buf = fs.readFileSync(filePath)
const wb = XLSX.read(buf)

console.log('═══════════════════════════════════════════════════')
console.log('📊 FILE INFO')
console.log('═══════════════════════════════════════════════════')
console.log(`Sheets: ${wb.SheetNames.join(', ')}`)

// Sheet 1: Preview first rows
const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
console.log(`\n📋 Sheet "${wb.SheetNames[0]}" — ${data.length} dòng`)
console.log('───────────────────────────────────────────────────')

// Show columns
const cols = Object.keys(data[0] || {})
console.log(`Cột (${cols.length}): ${cols.join(' | ')}`)
console.log('───────────────────────────────────────────────────')

// Show first 5 rows (key fields only)
const previewCols = ['ID', 'SKU', 'Tên sản phẩm', 'Danh mục', 'Danh mục phụ', 'Thương hiệu', 'Giá', 'Đang bán']
console.log('\n🔍 5 dòng đầu tiên (rút gọn):')
for (const row of data.slice(0, 5)) {
  const preview = previewCols.map(c => `${c}: ${row[c] ?? '—'}`).join(' | ')
  console.log(`  → ${preview}`)
}

// Sheet 2: Summary
const wsSummary = wb.Sheets[wb.SheetNames[1]]
const summaryData = XLSX.utils.sheet_to_json<Record<string, unknown>>(wsSummary)
console.log(`\n📈 Sheet "${wb.SheetNames[1]}"`)
console.log('───────────────────────────────────────────────────')
for (const row of summaryData) {
  console.log(`  ${String(row['Danh mục'] || '').padEnd(30)} | Tổng: ${String(row['Tổng SP'] || '').padStart(5)} | Bán: ${String(row['Đang bán'] || '').padStart(5)} | Nổi bật: ${String(row['Nổi bật'] || '').padStart(3)}`)
}

console.log('\n═══════════════════════════════════════════════════')
console.log('✅ Preview hoàn tất!')
