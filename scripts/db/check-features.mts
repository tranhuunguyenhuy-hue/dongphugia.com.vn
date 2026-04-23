import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking features...');
    // Check if tbvs_products has anything related to features
    // Wait, the products table? Let's check products table first.
    const productsWithFeatures = await prisma.products.count({
        where: {
            features: { not: null }
        }
    });

    console.log(`Products with 'features' json populated: ${productsWithFeatures}`);

    // Check product_feature_values if the model exists
    try {
        const featureValuesCount = await (prisma as any).product_feature_values.count();
        console.log(`Total rows in product_feature_values: ${featureValuesCount}`);
        
        const productsWithFeatureValues = await prisma.products.count({
            where: {
                product_feature_values: { some: {} }
            }
        });
        console.log(`Products with associated product_feature_values: ${productsWithFeatureValues}`);
        
        // Grab one product to see what it looks like
        const sample = await prisma.products.findFirst({
            where: { product_feature_values: { some: {} } },
            include: { product_feature_values: { include: { product_features: true } } }
        });
        if (sample) {
            console.log('Sample product feature values:', JSON.stringify(sample.product_feature_values, null, 2));
        }

    } catch (e: any) {
        console.log('Error checking product_feature_values:', e.message);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
