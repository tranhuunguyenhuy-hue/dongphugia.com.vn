import fs from 'fs'
import path from 'path'

function getShowerBaseModel(sku) {
    // Tách các thành phần của SKU
    const parts = sku.split('/' ).map(p => p.split('#')[0])
    
    // Tìm Củ Sen / Van điều chỉnh (Bắt đầu bằng TBG, TBS, TBV, TVSM, DM)
    const mixer = parts.find(p => /^(TBG|TBS|TBV|TVSM|DM)/i.test(p))
    
    if (mixer) {
        return mixer.toUpperCase()
    }
    
    // Nếu không có Củ Sen (chỉ có Tay Sen TBW, hoặc Phụ kiện TBN), lấy phần tử đầu tiên
    return parts[0].toUpperCase()
}

function main() {
    const logPath = path.join(process.cwd(), 'scripts', 'showers', 'toto-showers-log.json')
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'))

    const groups = {}

    data.forEach(item => {
        const base = getShowerBaseModel(item.sku)
        if (!groups[base]) {
            groups[base] = []
        }
        groups[base].push({ sku: item.sku, name: item.name })
    })

    let countMulti = 0
    let totalInMulti = 0

    console.log(`Phân tích Sen Tắm TOTO theo Củ Sen (Mixer Valve):`)
    for (const [base, items] of Object.entries(groups)) {
        if (items.length > 1) {
            // console.log(`\n[Nhóm: ${base}] - ${items.length} sản phẩm`)
            // items.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
            countMulti++
            totalInMulti += items.length
        }
    }

    console.log(`\n=> Tổng số nhóm có nhiều tuỳ chọn: ${countMulti}`)
    console.log(`=> Tổng số sản phẩm nằm trong các nhóm này: ${totalInMulti}`)
    console.log(`=> Nhóm đông nhất có ${Math.max(...Object.values(groups).map(i => i.length))} sản phẩm.`)

    // Tìm và in ra nhóm đông nhất để kiểm tra
    for (const [base, items] of Object.entries(groups)) {
        if (items.length >= 8) {
            console.log(`\n[Nhóm lớn: ${base}] - ${items.length} sản phẩm`)
            items.forEach(i => console.log(`  - ${i.sku}`))
        }
    }
}

main()
