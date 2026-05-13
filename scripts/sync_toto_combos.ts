import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } });
    if (!brand) return;

    // Lấy tất cả các SP thiếu URL (đại đa số là combo)
    const combos = await prisma.products.findMany({
        where: { 
            brand_id: brand.id,
            source_url: null,
            is_active: true
        },
        select: { id: true, sku: true, name: true, description: true, specs: true }
    });

    console.log(`\n================================`);
    console.log(`🔄 BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU ${combos.length} SẢN PHẨM COMBO`);
    console.log(`================================\n`);

    let updatedCount = 0;

    for (const combo of combos) {
        if (!combo.sku.includes('/')) {
            // Không phải dạng ghép mã, bỏ qua
            continue;
        }

        const childSkus = combo.sku.split('/');
        
        let mergedDescription = '';
        const mergedAccessories = new Set<string>();
        const mergedDocs = new Map<string, any>();
        const mergedSpecs: any = {};
        
        let foundChildren = 0;

        for (const skuPart of childSkus) {
            // Loại bỏ các hậu tố phụ như #W, (x4), -S ... để dễ tìm mã gốc
            const cleanSku = skuPart.split('#')[0].replace(/\(x\d+\)/, '').trim();
            
            // Tìm sản phẩm con sát nghĩa nhất: ưu tiên mã ngắn (tránh dính combo khác)
            const childList = await prisma.products.findMany({
                where: { sku: { startsWith: cleanSku } },
                select: { sku: true, name: true, description: true, specs: true }
            });

            // Lọc ra thằng có mã ngắn nhất
            const child = childList.sort((a, b) => a.sku.length - b.sku.length)[0];

            if (child) {
                foundChildren++;
                
                // 1. Merge Description (Có box tên sản phẩm phân chia rõ ràng)
                if (child.description && child.description.length > 50) {
                    mergedDescription += `<div class="combo-child-desc my-6"><h3 class="text-xl font-bold text-brand-600 mb-4 bg-brand-50 p-3 rounded-lg border border-brand-100">➤ Phần ${foundChildren}: ${child.name}</h3>\n${child.description}\n</div>`;
                }

                // 2. Merge Specs
                if (child.specs && typeof child.specs === 'object') {
                    const specsObj = child.specs as any;
                    
                    // Phụ kiện đi kèm
                    if (Array.isArray(specsObj['Phụ kiện đi kèm'])) {
                        specsObj['Phụ kiện đi kèm'].forEach((acc: string) => mergedAccessories.add(`${child.sku}: ${acc}`));
                    }
                    
                    // Tài liệu
                    if (Array.isArray(specsObj['documents'])) {
                        specsObj['documents'].forEach((doc: any) => {
                            if (!mergedDocs.has(doc.url)) mergedDocs.set(doc.url, doc);
                        });
                    }
                    
                    // Các thông số khác (Kích thước, mã SP, v.v...)
                    for (const [key, val] of Object.entries(specsObj)) {
                        if (key !== 'Phụ kiện đi kèm' && key !== 'documents') {
                            if (!mergedSpecs[key]) {
                                mergedSpecs[key] = val;
                            } else if (mergedSpecs[key] !== val) {
                                // Prefix thêm tên SKU nếu bị trùng key mà giá trị khác (VD: "Kích thước")
                                mergedSpecs[`[${child.sku}] ${key}`] = val;
                            }
                        }
                    }
                }
            }
        }

        // Nếu có ít nhất 1 thành phần con được tìm thấy
        if (foundChildren > 0) {
            // Reconstruct specs
            if (mergedAccessories.size > 0) mergedSpecs['Phụ kiện đi kèm'] = Array.from(mergedAccessories);
            if (mergedDocs.size > 0) mergedSpecs['documents'] = Array.from(mergedDocs.values());

            // Lưu vào Database
            await prisma.products.update({
                where: { id: combo.id },
                data: {
                    description: mergedDescription,
                    specs: mergedSpecs,
                    is_combo: true // Confirm nó là combo
                }
            });
            updatedCount++;
            console.log(`✅ [${combo.sku}] Đã gộp thành công từ ${foundChildren} thành phần con.`);
        }
    }

    console.log(`\n🎉 Đã cập nhật dữ liệu thành công cho ${updatedCount} sản phẩm combo.`);
    await prisma.$disconnect();
}

main().catch(console.error);
