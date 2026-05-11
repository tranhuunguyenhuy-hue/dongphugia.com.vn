import fs from 'fs'
import path from 'path'

// Hàm trích xuất Base Model từ SKU
function getBaseModel(fullSku) {
    // 1. Loại bỏ các phần sau dấu / (ví dụ: /T53P100VR, /W)
    let sku = fullSku.split('/')[0]

    // 2. Loại bỏ mã màu sau dấu # (ví dụ: #XW, #NW1)
    sku = sku.split('#')[0]

    // 3. Tìm hậu tố nắp ở cuối chuỗi. Các mã nắp TOTO thường có dạng (T, E, W) + (số)
    // Ví dụ: T2, T3, T8, E2, E4, W4, W11, W14, v.v.
    // Đôi khi là T2X, W11Z... ta sẽ match T|E|W theo sau là chữ số và có thể có ký tự chữ ở cuối.
    const match = sku.match(/(.+?)(T\d+[A-Z]*|E\d+[A-Z]*|W\d+[A-Z]*)$/i)
    
    if (match) {
        return match[1] // Trả về Base Model (phần đầu)
    }

    // Nếu không khớp pattern nắp, có thể nó là model nguyên khối không tách nắp, hoặc mã nắp khác
    // Trả về chính nó (đã bỏ # và /)
    return sku
}

function main() {
    const logPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-toilets-log.json')
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'))

    const grouped = {}
    let unclassified = []

    data.forEach(item => {
        const base = getBaseModel(item.sku)
        if (!grouped[base]) {
            grouped[base] = []
        }
        grouped[base].push({ sku: item.sku, name: item.name })
    })

    console.log(`Tổng số Base Models tìm được: ${Object.keys(grouped).length}`)

    // In ra các nhóm có từ 2 sản phẩm trở lên
    let count = 0
    for (const [base, items] of Object.entries(grouped)) {
        if (items.length > 1) {
            console.log(`\nBase Model: ${base}`)
            items.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
            count++
        } else {
            unclassified.push(items[0])
        }
    }
    
    console.log(`\n=> Có ${count} nhóm Base Model có nhiều biến thể nắp/màu.`)
    console.log(`=> Có ${unclassified.length} sản phẩm đứng đơn lẻ (không có anh em cùng Base Model).`)
}

main()
