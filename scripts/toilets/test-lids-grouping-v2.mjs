import fs from 'fs'
import path from 'path'

function getLidSeries(name, sku) {
    name = name.toLowerCase()
    
    // Nắp Washlet (kiểm tra S2, S5, S7, C2, C5)
    if (name.includes('washlet')) {
        // Tên có thể là "Washlet S2 TOTO" hoặc "Washlet TOTO C2"
        const match = name.match(/(c2|c5|s2|s5|s7)/i)
        if (match) {
            return `WASHLET ${match[1].toUpperCase()}`
        }
        return "WASHLET KHÁC"
    }

    // Nắp Eco-washer
    if (name.includes('eco-washer') || name.includes('ecowasher') || name.includes('rửa cơ')) {
        return "ECO-WASHER"
    }

    // Nắp Đóng Êm
    if (name.includes('đóng êm') || name.includes('nắp êm')) {
        return "NẮP ĐÓNG ÊM"
    }

    return "KHÁC"
}

function main() {
    const logPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-lids-log.json')
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'))

    const groups = {}

    data.forEach(item => {
        const series = getLidSeries(item.name, item.sku)
        if (!groups[series]) {
            groups[series] = []
        }
        groups[series].push({ sku: item.sku, name: item.name })
    })

    let maxItems = 0;
    let maxGroup = '';

    console.log(`Phân loại chi tiết Nắp Bồn Cầu TOTO:`)
    for (const [series, items] of Object.entries(groups)) {
        if (items.length > maxItems) {
            maxItems = items.length;
            maxGroup = series;
        }
        console.log(`\n[${series}] - ${items.length} sản phẩm`)
        items.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
    }

    console.log(`\n=> Tổng số nhóm tạo ra: ${Object.keys(groups).length}`)
    console.log(`=> Nhóm đông nhất là [${maxGroup}] với ${maxItems} sản phẩm.`)
}

main()
