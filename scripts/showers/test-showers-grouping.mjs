import fs from 'fs'
import path from 'path'

function getShowerBaseModel(sku) {
    // Tách phần đầu tiên trước dấu '/', và bỏ màu (trước '#')
    let base = sku.split('/')[0].split('#')[0]
    
    // Một số trường hợp có thêm '-1' hoặc '-2', ta giữ nguyên vì nó có thể là khác biệt kỹ thuật
    // Tuy nhiên nếu mã có chữ VA hay V (Ví dụ: TBG04302VA), thì VA là bản update của V.
    // Thực tế Củ sen là Base chuẩn xác rồi.
    return base
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

    console.log(`Phân tích Sen Tắm TOTO theo Củ Sen (Base Model):`)
    for (const [base, items] of Object.entries(groups)) {
        if (items.length > 1) {
            console.log(`\n[Nhóm: ${base}] - ${items.length} sản phẩm`)
            items.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
            countMulti++
            totalInMulti += items.length
        }
    }

    console.log(`\n=> Tổng số nhóm có nhiều tuỳ chọn: ${countMulti}`)
    console.log(`=> Tổng số sản phẩm nằm trong các nhóm này: ${totalInMulti}`)
    console.log(`=> Số sản phẩm đứng 1 mình (không có tay sen khác): ${data.length - totalInMulti}`)
}

main()
