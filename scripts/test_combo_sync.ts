import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const comboIds = [754, 1183]; // 754: Bồn cầu thông minh, 1183: Vòi bồn tắm
    
    for (const id of comboIds) {
        const combo = await prisma.products.findUnique({ where: { id } });
        if (!combo || !combo.sku) continue;

        console.log(`\n================================`);
        console.log(`🛠️ Processing Combo: ${combo.sku}`);
        console.log(`================================`);

        const childSkus = combo.sku.split('/');
        
        let mergedDescription = '';
        const mergedAccessories = new Set<string>();
        const mergedDocs = new Map<string, any>();
        const mergedSpecs: any = {};

        for (const skuPart of childSkus) {
            // Find base sku by removing variant parts like #W or (x4)
            const cleanSku = skuPart.split('#')[0].replace(/\(x\d+\)/, '').trim();
            
            // Search for product in DB
            const child = await prisma.products.findFirst({
                where: { 
                    sku: { startsWith: cleanSku },
                    is_combo: false
                },
                select: { sku: true, name: true, description: true, specs: true }
            });

            if (child) {
                console.log(`   ✅ Found child: ${child.sku} - ${child.name}`);
                
                // 1. Merge Description
                if (child.description && child.description.length > 50) {
                    mergedDescription += `<div class="combo-child-desc my-6"><h3 class="text-xl font-bold text-brand-600 mb-4 bg-brand-50 p-3 rounded-lg border border-brand-100">➤ ${child.name}</h3>\n${child.description}\n</div>`;
                }

                // 2. Merge Specs
                if (child.specs && typeof child.specs === 'object') {
                    const specsObj = child.specs as any;
                    
                    // Phụ kiện
                    if (Array.isArray(specsObj['Phụ kiện đi kèm'])) {
                        specsObj['Phụ kiện đi kèm'].forEach((acc: string) => mergedAccessories.add(`${child.sku}: ${acc}`));
                    }
                    
                    // Documents
                    if (Array.isArray(specsObj['documents'])) {
                        specsObj['documents'].forEach((doc: any) => {
                            if (!mergedDocs.has(doc.url)) mergedDocs.set(doc.url, doc);
                        });
                    }
                    
                    // Normal Specs
                    for (const [key, val] of Object.entries(specsObj)) {
                        if (key !== 'Phụ kiện đi kèm' && key !== 'documents') {
                            // Only add if not exist, or prefix it
                            if (!mergedSpecs[key]) {
                                mergedSpecs[key] = val;
                            } else if (mergedSpecs[key] !== val) {
                                mergedSpecs[`${child.sku} - ${key}`] = val;
                            }
                        }
                    }
                }
            } else {
                console.log(`   ❌ Child not found for part: ${cleanSku}`);
            }
        }

        // Reconstruct specs
        if (mergedAccessories.size > 0) mergedSpecs['Phụ kiện đi kèm'] = Array.from(mergedAccessories);
        if (mergedDocs.size > 0) mergedSpecs['documents'] = Array.from(mergedDocs.values());

        // Update Combo product
        await prisma.products.update({
            where: { id: combo.id },
            data: {
                description: mergedDescription || combo.description,
                specs: Object.keys(mergedSpecs).length > 0 ? mergedSpecs : combo.specs
            }
        });

        console.log(`\n🎉 Merged Data for ${combo.sku}:`);
        console.log(`   - Desc length: ${mergedDescription.length}`);
        console.log(`   - Accessories: ${mergedAccessories.size}`);
        console.log(`   - Documents: ${mergedDocs.size}`);
        console.log(`   - Specs keys: ${Object.keys(mergedSpecs).length}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
