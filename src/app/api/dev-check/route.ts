import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const featureValuesCount = await prisma.product_feature_values.count();
        const productsWithFeatureValues = await prisma.products.count({
            where: {
                product_feature_values: { some: {} }
            }
        });
        
        let sample = null;
        if (productsWithFeatureValues > 0) {
            sample = await prisma.products.findFirst({
                where: { product_feature_values: { some: {} } },
                include: { product_feature_values: { include: { product_features: true } } }
            });
        }
        
        return NextResponse.json({
            success: true,
            featureValuesCount,
            productsWithFeatureValues,
            sample
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
