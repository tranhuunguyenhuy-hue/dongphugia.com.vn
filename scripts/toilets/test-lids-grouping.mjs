import fs from 'fs'
import path from 'path'

function getLidSeries(name, sku) {
    name = name.toLowerCase()
    
    // Nắp Washlet
    if (name.includes('washlet')) {
        const match = name.match(/washlet\s+(c\d|s\d|g\d)/i)
        if (match) {
            return `WASHLET ${match[1].toUpperCase()}`
        }
        // Trường hợp không có C2, S2 (như TCF4911Z)
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

    console.log(`Phân loại Nắp Bồn Cầu TOTO:`)
    for (const [series, items] of Object.entries(groups)) {
        console.log(`\n[${series}] - ${items.length} sản phẩm`)
        const displayItems = items.slice(0, 5)
        displayItems.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
        if (items.length > 5) console.log(`  ... và ${items.length - 5} sản phẩm khác.`)
    }
}

main()
