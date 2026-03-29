import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const results: Record<string, number> = {};

        // Helper function for each model
        async function updateModelSkus(model: any, modelName: string) {
            const items = await model.findMany({
                where: {
                    sku: {
                        startsWith: "TDM-"
                    }
                },
                select: { id: true, sku: true }
            });

            let updatedCount = 0;
            for (const item of items) {
                const newSku = item.sku.replace(/^TDM-/, "");
                await model.update({
                    where: { id: item.id },
                    data: { sku: newSku }
                }).catch((e: any) => {
                    console.error(`Failed to update ${modelName} ID ${item.id}:`, e.message);
                });
                updatedCount++;
            }
            results[modelName] = updatedCount;
        }

        // Run for all product models
        await updateModelSkus(prisma.tbvs_products, "tbvs_products");
        await updateModelSkus(prisma.products, "products");
        await updateModelSkus(prisma.bep_products, "bep_products");
        await updateModelSkus(prisma.nuoc_products, "nuoc_products");
        await updateModelSkus(prisma.sango_products, "sango_products");

        return NextResponse.json({
            message: "Successfully cleaned SKUs",
            results
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}
