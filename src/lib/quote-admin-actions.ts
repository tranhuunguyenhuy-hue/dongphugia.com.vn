"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateQuoteStatus(id: string, status: string) {
    const validStatuses = ["PENDING", "CONTACTED", "DONE"];
    if (!validStatuses.includes(status)) {
        return { success: false, error: "Trạng thái không hợp lệ" };
    }

    try {
        await prisma.quoteRequest.update({
            where: { id },
            data: { status },
        });
        revalidatePath("/admin/bao-gia");
        return { success: true };
    } catch (error) {
        console.error("Update quote status error:", error);
        return { success: false, error: "Đã có lỗi xảy ra" };
    }
}

export async function deleteQuoteRequest(id: string) {
    try {
        // Delete items first, then the request
        await prisma.quoteItem.deleteMany({ where: { quoteRequestId: id } });
        await prisma.quoteRequest.delete({ where: { id } });
        revalidatePath("/admin/bao-gia");
        return { success: true };
    } catch (error) {
        console.error("Delete quote error:", error);
        return { success: false, error: "Đã có lỗi xảy ra" };
    }
}
