import fs from 'fs'
import path from 'path'

function getLidBaseSKU(sku) {
    // Chỉ loại bỏ mã màu (ví dụ: #NW1, #W, #XW)
    return sku.split('#')[0]
}

function main() {
    const logPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-lids-log.json')
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'))

    const groups = {}

    data.forEach(item => {
        const base = getLidBaseSKU(item.sku)
        if (!groups[base]) {
            groups[base] = []
        }
        groups[base].push({ sku: item.sku, name: item.name })
    })

    let countMulti = 0
    console.log(`Phân tích Nắp Bồn Cầu TOTO theo Mã Gốc (bỏ mã màu):`)
    for (const [base, items] of Object.entries(groups)) {
        if (items.length > 1) {
            console.log(`\n[${base}] - ${items.length} sản phẩm`)
            items.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
            countMulti++
        }
    }

    console.log(`\n=> Có ${countMulti} mã nắp có nhiều biến thể màu sắc.`)
    console.log(`=> Có ${Object.keys(groups).length - countMulti} mã nắp chỉ có 1 màu duy nhất.`)
}

main()
