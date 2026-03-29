const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const brandsDir = path.join(__dirname, 'public', 'images', 'brands');

async function updateLogos() {
    try {
        const availableLogos = fs.readdirSync(brandsDir).map(file => file.split('.')[0]);
        console.log('Available downloaded logos:', availableLogos);

        const tables = ['tbvs_brands', 'bep_brands', 'nuoc_brands', 'partners'];
        
        for (const tableName of tables) {
            // Check if model exists in prisma
            if (!prisma[tableName]) {
                console.log(`Model ${tableName} does not exist in Prisma. Skipping.`);
                continue;
            }

            const records = await prisma[tableName].findMany();
            console.log(`Found ${records.length} records in ${tableName}`);

            let updateCount = 0;
            for (const record of records) {
                // If the brand slug exists in the downloaded logos, we set the logo_url
                if (record.slug && availableLogos.includes(record.slug)) {
                    const ext = fs.readdirSync(brandsDir).find(f => f.startsWith(record.slug + '.')).split('.')[1];
                    const logoUrl = `/images/brands/${record.slug}.${ext}`;
                    
                    await prisma[tableName].update({
                        where: { id: record.id },
                        data: { logo_url: logoUrl }
                    });
                    updateCount++;
                }
            }
            console.log(`Updated ${updateCount} records in ${tableName}`);
        }
        
        console.log('Finished updating database.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

updateLogos();
