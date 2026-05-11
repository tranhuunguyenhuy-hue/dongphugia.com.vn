import fs from 'fs'
import path from 'path'

// Hàm giả lập logic của Hita: Lấy phần mã chữ số đầu tiên (VD: MS889, CS769)
function getHitaBaseModel(fullSku) {
    // 1. Bỏ phần / và #
    let sku = fullSku.split('/')[0].split('#')[0].trim()

    // 2. Lấy 5 ký tự đầu tiên? 
    // Tuy nhiên, TOTO có những mã như C91, C920 (dưới 5 ký tự)
    // Tốt nhất là dùng Regex để lấy cụm [Chữ cái] + [Chữ số] đầu tiên
    // Ví dụ: MS889CDR -> MS889. CS945DNT8 -> CS945.
    const match = sku.match(/^([A-Z]+\d+)/i)
    if (match) {
        return match[1]
    }
    
    // Nếu không khớp (ít khi xảy ra), lấy 5 ký tự đầu
    return sku.substring(0, 5)
}

function main() {
    const logPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-toilets-log.json')
    if (!fs.existsSync(logPath)) {
        console.log("Không tìm thấy file log.")
        return
    }
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'))

    const hitaGroups = {}

    data.forEach(item => {
        const base = getHitaBaseModel(item.sku)
        if (!hitaGroups[base]) {
            hitaGroups[base] = []
        }
        hitaGroups[base].push({ sku: item.sku, name: item.name })
    })

    console.log(`Tổng số Base Models (theo logic HITA): ${Object.keys(hitaGroups).length}\n`)

    let count = 0
    let totalItemsInLargeGroups = 0
    for (const [base, items] of Object.entries(hitaGroups)) {
        if (items.length > 1) {
            console.log(`[HITA Base] ${base} - Tổng cộng ${items.length} biến thể`)
            // Chỉ in ra 5 mẫu đại diện nếu quá nhiều, hoặc in tất cả
            const displayItems = items.slice(0, 10)
            displayItems.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
            if (items.length > 10) console.log(`  ... và ${items.length - 10} biến thể khác.`)
            console.log('')
            count++
            totalItemsInLargeGroups += items.length
        }
    }
    
    console.log(`=> Có ${count} nhóm lớn. Tổng số sản phẩm nằm trong các nhóm này: ${totalItemsInLargeGroups}`)
}

main()
