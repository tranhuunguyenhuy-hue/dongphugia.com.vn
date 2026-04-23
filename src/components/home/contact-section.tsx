'use client'

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function ContactSection() {
    return (
        <section className="bg-stone-50 py-16 lg:py-24">
            <div className="u-container max-w-3xl mx-auto">
                <div className="bg-white rounded-[32px] p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 relative overflow-hidden">
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#2E7A96]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                    
                    <div className="relative z-10">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold text-neutral-900 mb-3 tracking-tight">Gửi yêu cầu trực tuyến</h2>
                            <p className="text-neutral-500 text-base max-w-md mx-auto">
                                Điền thông tin bên dưới, chuyên viên của Đông Phú Gia sẽ phản hồi lại bạn nhanh nhất.
                            </p>
                        </div>

                        <form className="flex flex-col gap-6" onSubmit={(e) => {
                            e.preventDefault();
                            alert("Form đang ở chế độ giao diện, tính năng gửi sẽ được kích hoạt sau khi có API.");
                        }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2.5">
                                    <label htmlFor="name" className="text-sm font-medium text-neutral-700">Họ và tên <span className="text-red-500">*</span></label>
                                    <Input 
                                        id="name" 
                                        placeholder="VD: Nguyễn Văn A" 
                                        required 
                                        className="h-12 bg-neutral-50 border-neutral-200 focus-visible:ring-[#2E7A96] focus-visible:border-[#2E7A96]"
                                    />
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    <label htmlFor="phone" className="text-sm font-medium text-neutral-700">Số điện thoại <span className="text-red-500">*</span></label>
                                    <Input 
                                        id="phone" 
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
                                    type="email"
                                    placeholder="VD: example@email.com" 
                                    className="h-12 bg-neutral-50 border-neutral-200 focus-visible:ring-[#2E7A96] focus-visible:border-[#2E7A96]"
                                />
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="message" className="text-sm font-medium text-neutral-700">Nội dung tư vấn <span className="text-red-500">*</span></label>
                                <Textarea 
                                    id="message" 
                                    placeholder="Bạn đang muốn tìm mua dòng sản phẩm nào? Hoặc để lại lời nhắn cho chúng tôi..." 
                                    required 
                                    rows={5}
                                    className="resize-none bg-neutral-50 border-neutral-200 shadow-none focus-visible:ring-[#2E7A96] focus-visible:border-[#2E7A96] p-4 text-base"
                                />
                            </div>

                            <Button type="submit" className="h-14 mt-4 bg-[#2E7A96] hover:bg-[#256579] text-base gap-2 w-full shadow-lg shadow-[#2E7A96]/20 transition-all active:scale-[0.98] rounded-xl">
                                Gửi yêu cầu tư vấn
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    )
}
