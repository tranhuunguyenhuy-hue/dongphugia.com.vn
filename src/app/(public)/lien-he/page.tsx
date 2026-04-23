"use client";

import { Mail, MapPin, Phone, Globe, Clock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { siteConfig } from "@/config/site";
import { useState } from "react";
import { toast } from "sonner";

export default function ContactPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get("name") as string,
            phone: formData.get("phone") as string,
            email: formData.get("email") as string,
            message: formData.get("message") as string,
        };

        try {
            const res = await fetch('/api/quote-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            
            if (result.success) {
                toast.success("Đã gửi yêu cầu thành công!", {
                    description: "Chúng tôi sẽ sớm liên hệ lại với bạn."
                });
                (e.target as HTMLFormElement).reset();
            } else {
                toast.error("Không thể gửi yêu cầu", {
                    description: result.error || result.message || "Vui lòng thiết lập lại thông tin."
                });
            }
        } catch (error) {
            toast.error("Lỗi hệ thống", {
                description: "Đã có lỗi xảy ra. Vui lòng thử lại sau."
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    return (
        <div className="w-full bg-neutral-50/50 min-h-screen pb-20">
            {/* Header Area */}
            <div className="w-full bg-white border-b border-neutral-200">
                <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 py-16 lg:py-24">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8f1f4] text-[#2E7A96] text-sm font-medium mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E7A96] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2E7A96]"></span>
                            </span>
                            Chúng tôi luôn sẵn sàng
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 tracking-tight leading-[1.1] mb-6">
                            Liên hệ tư vấn <br className="hidden md:block" />
                            <span className="text-[#2E7A96] italic font-serif font-medium">cùng Đông Phú Gia</span>
                        </h1>
                        <p className="text-lg text-neutral-600 leading-relaxed max-w-xl">
                            Hãy chia sẻ nhu cầu dự án của bạn. Đội ngũ chuyên gia của chúng tôi sẽ liên hệ lại trong thời gian sớm nhất để mang đến các giải pháp vật liệu tối ưu.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
                    
                    {/* Left: Contact Info */}
                    <div className="lg:col-span-5 flex flex-col gap-10">
                        <div>
                            <h2 className="text-2xl font-bold text-neutral-900 mb-8">Thông tin liên hệ</h2>
                            <div className="flex flex-col gap-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-white border border-neutral-200 text-[#2E7A96] shadow-sm">
                                        <MapPin className="w-5 h-5 stroke-[1.5]" />
                                    </div>
                                    <div className="flex flex-col pt-1">
                                        <span className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-1.5">Showroom Đông Phú Gia</span>
                                        <span className="text-base text-neutral-900 font-medium leading-relaxed">
                                            {siteConfig.contact.address}<br />
                                            {siteConfig.contact.addressLine2}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-white border border-neutral-200 text-[#2E7A96] shadow-sm">
                                        <Phone className="w-5 h-5 stroke-[1.5]" />
                                    </div>
                                    <div className="flex flex-col pt-1">
                                        <span className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-1.5">Hotline Tổng Đài</span>
                                        <a href={`tel:${siteConfig.contact.phone}`} className="text-base text-neutral-900 font-bold hover:text-[#2E7A96] transition-colors">
                                            {siteConfig.contact.hotlineLabel}
                                        </a>
                                        <span className="text-sm text-neutral-500 mt-0.5">CSKH - Sale - Tư vấn sản phẩm</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-white border border-neutral-200 text-[#2E7A96] shadow-sm">
                                        <Mail className="w-5 h-5 stroke-[1.5]" />
                                    </div>
                                    <div className="flex flex-col pt-1">
                                        <span className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-1.5">Email Hỗ Trợ</span>
                                        <a href={`mailto:${siteConfig.contact.email}`} className="text-base text-neutral-900 font-medium hover:text-[#2E7A96] transition-colors">
                                            {siteConfig.contact.email}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-white border border-neutral-200 text-[#2E7A96] shadow-sm">
                                        <Globe className="w-5 h-5 stroke-[1.5]" />
                                    </div>
                                    <div className="flex flex-col pt-1">
                                        <span className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-1.5">Website</span>
                                        <a href={siteConfig.url} target="_blank" rel="noopener noreferrer" className="text-base text-neutral-900 font-medium hover:text-[#2E7A96] transition-colors">
                                            {siteConfig.url.replace('https://', '')}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-white border border-neutral-200 text-[#2E7A96] shadow-sm">
                                        <Clock className="w-5 h-5 stroke-[1.5]" />
                                    </div>
                                    <div className="flex flex-col pt-1">
                                        <span className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-1.5">Giờ Mở Cửa</span>
                                        <span className="text-base text-neutral-900 font-medium">
                                            {siteConfig.contact.workingHours}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Contact Form */}
                    <div className="lg:col-span-7">
                        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 relative overflow-hidden">
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#2E7A96]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                            
                            <div className="relative z-10">
                                <h3 className="text-2xl font-bold text-neutral-900 mb-2">Gửi yêu cầu trực tuyến</h3>
                                <p className="text-neutral-500 text-sm mb-8">Điền thông tin bên dưới, chúng tôi sẽ phản hồi lại bạn nhanh nhất.</p>

                                <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="flex flex-col gap-2.5">
                                            <label htmlFor="name" className="text-sm font-medium text-neutral-700">Họ và tên <span className="text-red-500">*</span></label>
                                            <Input 
                                                id="name" 
                                                name="name" 
                                                placeholder="VD: Nguyễn Văn A" 
                                                required 
                                                className="h-12 bg-neutral-50 border-neutral-200 focus-visible:ring-[#2E7A96] focus-visible:border-[#2E7A96]"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2.5">
                                            <label htmlFor="phone" className="text-sm font-medium text-neutral-700">Số điện thoại <span className="text-red-500">*</span></label>
                                            <Input 
                                                id="phone" 
                                                name="phone" 
                                                type="tel"
                                                placeholder="VD: 09..." 
                                                required 
                                                className="h-12 bg-neutral-50 border-neutral-200 focus-visible:ring-[#2E7A96] focus-visible:border-[#2E7A96]"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2.5">
                                        <label htmlFor="email" className="text-sm font-medium text-neutral-700">Email</label>
                                        <Input 
                                            id="email" 
                                            name="email" 
                                            type="email"
                                            placeholder="VD: example@email.com" 
                                            className="h-12 bg-neutral-50 border-neutral-200 focus-visible:ring-[#2E7A96] focus-visible:border-[#2E7A96]"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2.5">
                                        <label htmlFor="message" className="text-sm font-medium text-neutral-700">Nội dung tư vấn <span className="text-red-500">*</span></label>
                                        <Textarea 
                                            id="message" 
                                            name="message" 
                                            placeholder="Bạn đang muốn tìm mua dòng sản phẩm nào? Hoặc để lại lời nhắn cho chúng tôi..." 
                                            required 
                                            rows={5}
                                            className="resize-none bg-neutral-50 border-neutral-200 shadow-none focus-visible:ring-[#2E7A96] focus-visible:border-[#2E7A96] p-4 text-base"
                                        />
                                    </div>

                                    <Button 
                                        type="submit" 
                                        disabled={isSubmitting}
                                        className="h-14 mt-2 bg-[#2E7A96] hover:bg-[#256579] text-base gap-2 w-full sm:w-auto self-start px-10 shadow-lg shadow-[#2E7A96]/20 transition-all active:scale-[0.98]"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Đang gửi...
                                            </>
                                        ) : (
                                            <>
                                                Gửi yêu cầu tư vấn
                                                <ArrowRight className="w-5 h-5" />
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-neutral-400 mt-2">
                                        * Thông tin của bạn sẽ được bảo mật tuyệt đối theo chính sách của Đông Phú Gia.
                                    </p>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full width Map Section */}
                <div className="mt-20 w-full rounded-2xl overflow-hidden border border-neutral-200 shadow-sm bg-white h-[450px]">
                    <iframe 
                        // Note: Using search syntax to find "Đông Phú Gia Đà Lạt" correctly or the exact address
                        src={siteConfig.mapUrl}
                        width="100%" 
                        height="100%" 
                        style={{ border: 0 }} 
                        allowFullScreen={true} 
                        loading="lazy" 
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Bản đồ đường đi Showroom Đông Phú Gia"
                        className="grayscale-[0.2] contrast-[0.9] opacity-90 transition-all duration-700 hover:grayscale-0 hover:opacity-100 hover:contrast-100"
                    />
                </div>
            </div>
        </div>
    );
}
