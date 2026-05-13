import { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { Phone, CheckCircle2, ShieldCheck, Wrench, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pricingData } from "./data";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Dịch Vụ Lắp Đặt Thiết Bị Vệ Sinh Chuyên Nghiệp | Đông Phú Gia",
    description: "Bảng giá dịch vụ lắp đặt thiết bị vệ sinh, bồn cầu, lavabo, phòng tắm kính chuyên nghiệp tại Đông Phú Gia. Cam kết minh bạch, thợ lành nghề, bảo hành dài hạn.",
};

const processes = [
    {
        icon: Phone,
        title: "1. Tiếp nhận yêu cầu",
        desc: "Khách hàng liên hệ Hotline hoặc Zalo để cung cấp thông tin thiết bị cần lắp đặt và địa chỉ.",
    },
    {
        icon: AlertCircle,
        title: "2. Khảo sát & Báo giá",
        desc: "Kỹ thuật viên tư vấn giải pháp, báo giá minh bạch dựa trên bảng giá niêm yết không phát sinh.",
    },
    {
        icon: Wrench,
        title: "3. Thi công chuyên nghiệp",
        desc: "Đội ngũ thợ lành nghề tiến hành lắp đặt đúng tiêu chuẩn kỹ thuật, đảm bảo thẩm mỹ và vệ sinh.",
    },
    {
        icon: CheckCircle2,
        title: "4. Nghiệm thu & Bảo hành",
        desc: "Bàn giao hạng mục, hướng dẫn sử dụng và kích hoạt chế độ bảo hành dịch vụ dài hạn.",
    }
];

export default function InstallationServicePage() {
    return (
        <div className="w-full bg-neutral-50/50 min-h-screen pb-20">
            {/* Header Area */}
            <div className="w-full bg-white border-b border-neutral-200">
                <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 py-16 lg:py-24">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8f1f4] text-[#2E7A96] text-sm font-medium mb-6">
                            <ShieldCheck className="w-4 h-4" />
                            Đội ngũ kỹ thuật viên chuyên nghiệp
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 tracking-tight leading-[1.1] mb-6">
                            Dịch vụ lắp đặt <br className="hidden md:block" />
                            <span className="text-[#2E7A96] italic font-serif font-medium">Thiết bị vệ sinh & Nội thất</span>
                        </h1>
                        <p className="text-lg text-neutral-600 leading-relaxed max-w-2xl mb-8">
                            Đông Phú Gia cung cấp dịch vụ lắp đặt chuyên nghiệp với bảng giá công khai minh bạch. Đội ngũ thợ lành nghề đảm bảo thi công đúng chuẩn kỹ thuật, an toàn và thẩm mỹ cao cho không gian sống của bạn.
                        </p>
                        <div className="flex flex-wrap items-center gap-4">
                            <Button size="lg" className="bg-[#2E7A96] hover:bg-[#25667d] text-white h-12 px-8 text-base shadow-sm" asChild>
                                <a href={`tel:${siteConfig.contact.businessRoom.replace(/\s+/g, '')}`}>
                                    <Phone className="w-4 h-4 mr-2" />
                                    Gọi tư vấn lắp đặt: {siteConfig.contact.businessRoom}
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 py-16">
                
                {/* Process Section */}
                <div className="mb-20">
                    <div className="mb-10 text-center max-w-2xl mx-auto">
                        <h2 className="text-3xl font-bold text-neutral-900 mb-4">Quy trình dịch vụ</h2>
                        <p className="text-neutral-600">Quy trình làm việc chuẩn mực, nhanh chóng và chuyên nghiệp để mang lại trải nghiệm tốt nhất cho khách hàng.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {processes.map((p, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:scale-150 transition-transform duration-500">
                                    <p.icon className="w-24 h-24" />
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-[#e8f1f4] text-[#2E7A96] flex items-center justify-center mb-6 relative z-10">
                                    <p.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-neutral-900 mb-3 relative z-10">{p.title}</h3>
                                <p className="text-neutral-600 leading-relaxed relative z-10 text-sm">{p.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pricing Table Section */}
                <div className="mb-20">
                    <div className="mb-10 text-center max-w-2xl mx-auto">
                        <h2 className="text-3xl font-bold text-neutral-900 mb-4">Bảng giá tham khảo</h2>
                        <p className="text-neutral-600">Mức giá tham khảo cho các hạng mục lắp đặt tiêu chuẩn. Chi phí thực tế có thể thay đổi tùy thuộc vào điều kiện thi công thực tế tại công trình.</p>
                    </div>

                    <div className="flex flex-col gap-12 max-w-4xl mx-auto">
                        {pricingData.map((category, idx) => (
                            <div key={idx} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden" id={category.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
                                {/* Category Header */}
                                <div className="bg-neutral-100/80 px-6 py-4 border-b border-neutral-200 flex items-center">
                                    <h3 className="text-xl font-bold text-neutral-900">{category.category}</h3>
                                </div>
                                
                                {/* Table Headers (Desktop) */}
                                <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-neutral-50/50 border-b border-neutral-100 text-sm font-semibold text-neutral-500">
                                    <div className="col-span-7">Hạng mục</div>
                                    <div className="col-span-2 text-center">Dịch vụ</div>
                                    <div className="col-span-3 text-right">Đơn giá / Bộ</div>
                                </div>

                                {/* Items List */}
                                <div className="divide-y divide-neutral-100">
                                    {category.items.map((item, itemIdx) => (
                                        <div key={itemIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-4 hover:bg-neutral-50/50 transition-colors items-center">
                                            <div className="col-span-1 sm:col-span-7">
                                                <span className="font-medium text-neutral-900">{item.name}</span>
                                            </div>
                                            <div className="col-span-1 sm:col-span-2 flex sm:justify-center">
                                                <span className="inline-flex px-2 py-1 rounded-md bg-neutral-100 text-neutral-600 text-xs font-medium">
                                                    {item.service}
                                                </span>
                                            </div>
                                            <div className="col-span-1 sm:col-span-3 flex sm:justify-end">
                                                <span className="font-bold text-[#2E7A96]">{item.price}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div className="bg-[#fff9e6] border border-[#fadd82] rounded-xl p-5 text-sm text-neutral-700 leading-relaxed">
                            <p className="font-bold text-neutral-900 flex items-center gap-2 mb-2">
                                <AlertCircle className="w-5 h-5 text-[#e5a900]" />
                                Lưu ý quan trọng:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Bảng giá trên mang tính chất tham khảo cho các điều kiện thi công tiêu chuẩn.</li>
                                <li>Phí lắp đặt chưa bao gồm phí cắt đá, thay đổi đường ống nước âm tường, điện âm tường hoặc phí di chuyển/cẩu thiết bị nặng (bồn tắm) lên lầu cao.</li>
                                <li>Vui lòng liên hệ trực tiếp với Phòng Kinh Doanh để được khảo sát và báo giá chính xác nhất cho công trình của bạn.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom CTA */}
                <div className="bg-[#2E7A96] rounded-3xl overflow-hidden shadow-lg border border-[#25667d]">
                    <div className="px-8 py-16 text-center max-w-3xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Bạn cần lắp đặt thiết bị ngay?</h2>
                        <p className="text-white/90 text-lg mb-10 leading-relaxed">
                            Liên hệ ngay với chúng tôi để đặt lịch khảo sát và thi công nhanh chóng, an toàn.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button size="lg" className="bg-white text-[#2E7A96] hover:bg-neutral-100 h-14 px-8 text-base shadow-sm font-bold" asChild>
                                <a href={`tel:${siteConfig.contact.businessRoom.replace(/\s+/g, '')}`}>
                                    <Phone className="w-5 h-5 mr-2" />
                                    Gọi ngay: {siteConfig.contact.businessRoom}
                                </a>
                            </Button>
                            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 h-14 px-8 text-base bg-transparent" asChild>
                                <Link href="/lien-he">
                                    Để lại lời nhắn
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
