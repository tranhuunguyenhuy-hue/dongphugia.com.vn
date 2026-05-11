import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Hàm trích xuất Series cho nắp bồn cầu
function getLidSeries(name) {
    const lower = name.toLowerCase()
    
    if (lower.includes('washlet')) {
        const match = lower.match(/(c2|c5|s2|s5|s7)/i)
        if (match) {
            return `WASHLET ${match[1].toUpperCase()}`
        }
        return "WASHLET KHÁC"
    }

    if (lower.includes('eco-washer') || lower.includes('ecowasher') || lower.includes('rửa cơ')) {
        return "ECO-WASHER"
    }

    if (lower.includes('đóng êm') || lower.includes('nắp êm')) {
        return "NẮP ĐÓNG ÊM"
    }

    return "KHÁC"
}

async function main() {
    console.log('Fetching TOTO Lids from database...')
    
    // Tìm brand TOTO
    const brand = await prisma.brands.findFirst({
        where: { name: { contains: 'TOTO' } }
    })
    
    if (!brand) {
        console.error('Khong tim thay brand TOTO')
        return
    }



    // Lấy tất cả Nắp bồn cầu TOTO
    const products = await prisma.products.findMany({
        where: {
            brand_id: brand.id,
            subcategory_id: 9 // ID Nắp Bồn Cầu
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true
        }
    })

    console.log(`Found ${products.length} TOTO lids.`)

    const updates = []
    
    // Tạo mảng Updates
    for (const p of products) {
        const newGroup = getLidSeries(p.name)
        
        // Luôn luôn update để đảm bảo đồng bộ
        updates.push(
            prisma.products.update({
                where: { id: p.id },
                data: { variant_group: newGroup }
            })
        )
        console.log(`[${newGroup}] <- ${p.sku} | ${p.name}`)
    }

    console.log(`\nExecuting ${updates.length} updates...`)
    
    // Chạy transaction
    try {
        await prisma.$transaction(updates)
        console.log('✅ Successfully applied variant groups to all TOTO Lids!')
    } catch (e) {
        console.error('❌ Failed to update:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
