const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const tbvs = await prisma.tbvs_brands.findMany({ select: { slug: true, name: true } });
    const bep = await prisma.bep_brands.findMany({ select: { slug: true, name: true } });
    const nuoc = await prisma.nuoc_brands.findMany({ select: { slug: true, name: true } });

    const allBrands = [...tbvs, ...bep, ...nuoc];
    // deduplicate by slug
    const uniqueBrandsMap = new Map();
    allBrands.forEach(b => uniqueBrandsMap.set(b.slug, b.name));
    
    const existingFiles = fs.readdirSync('public/images/brands');
    const existingSlugs = new Set();
    existingFiles.forEach(f => {
        if(f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.svg')) {
            existingSlugs.add(f.split('.')[0]);
        }
    });

    const missing = [];
    uniqueBrandsMap.forEach((name, slug) => {
        if (!existingSlugs.has(slug)) {
            missing.push({ slug, name });
        }
    });

    console.log("Missing Brands:", missing.map(m => m.slug).join(', '));
    fs.writeFileSync('missing_brands.json', JSON.stringify(missing, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
