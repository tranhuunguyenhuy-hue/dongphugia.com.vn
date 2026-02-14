"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitQuoteRequest(data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    productId: string;
}) {
    try {
        // Server-side validation
        if (!data.customerName || data.customerName.trim().length < 2) {
            return { success: false, error: "Vui lòng nhập họ tên (ít nhất 2 ký tự)" };
        }

        const phoneRegex = /^(0|\+84)[0-9]{8,10}$/;
        if (!data.customerPhone || !phoneRegex.test(data.customerPhone.replace(/\s/g, ""))) {
            return { success: false, error: "Số điện thoại không hợp lệ" };
        }

        if (data.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
            return { success: false, error: "Email không hợp lệ" };
        }

        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: data.productId },
            select: { id: true },
        });

        if (!product) {
            return { success: false, error: "Sản phẩm không tồn tại" };
        }

        // Create quote request with item
        await prisma.quoteRequest.create({
            data: {
                customerName: data.customerName.trim(),
                customerPhone: data.customerPhone.replace(/\s/g, ""),
                customerEmail: data.customerEmail?.trim() || null,
                items: {
                    create: {
                        productId: data.productId,
                        quantity: 1,
                    },
                },
            },
        });

        revalidatePath("/admin/bao-gia");
        return { success: true };
    } catch (error) {
        console.error("Quote request error:", error);
        return { success: false, error: "Đã có lỗi xảy ra. Vui lòng thử lại." };
    }
}
