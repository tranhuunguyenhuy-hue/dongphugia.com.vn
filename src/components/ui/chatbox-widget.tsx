"use client";

import { useState, useEffect, useRef } from "react";
import { Send, X, Bot, User, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

import { siteConfig } from "@/config/site";

// --- Rule-based Database ---
const KNOWLEDGE_BASE = [
    {
        keywords: ["giá", "bao nhiêu", "bảng giá", "chi phí", "tiền"],
        response: `Dạ, giá sản phẩm dao động tùy thuộc vào mẫu mã và thương hiệu. Để nhận báo giá chính xác kèm ưu đãi tốt nhất, anh/chị vui lòng gọi Hotline: ${siteConfig.contact.hotlineLabel} ạ.`
    },
    {
        keywords: ["địa chỉ", "ở đâu", "cửa hàng", "showroom"],
        response: "Dạ, showroom Đông Phú Gia nằm tại: 257-259 Hai Bà Trưng, Phường 6, Đà Lạt, Lâm Đồng. Anh/chị có thể đến trực tiếp để xem sản phẩm nhé!"
    },
    {
        keywords: ["bảo hành", "sửa chữa", "lỗi"],
        response: `Dạ, tất cả sản phẩm chính hãng tại Đông Phú Gia đều được bảo hành theo tiêu chuẩn của nhà sản xuất. Anh/chị cần hỗ trợ kỹ thuật vui lòng gọi Phòng kinh doanh: ${siteConfig.contact.businessRoomLabel}.`
    },
    {
        keywords: ["giao hàng", "vận chuyển", "ship", "phí ship"],
        response: "Dạ, Đông Phú Gia hỗ trợ giao hàng toàn quốc. Miễn phí giao hàng trong nội thành Đà Lạt. Vui lòng liên hệ Hotline để biết chi tiết cước phí đi tỉnh ạ."
    },
    {
        keywords: ["có hàng", "còn hàng", "sẵn"],
        response: `Dạ, để kiểm tra tồn kho chính xác của sản phẩm này, anh/chị vui lòng để lại SĐT hoặc gọi trực tiếp Hotline: ${siteConfig.contact.hotlineLabel} giúp em nhé.`
    }
];

const FALLBACK_RESPONSE = `Dạ, câu hỏi này hơi chuyên sâu. Anh/chị vui lòng gọi trực tiếp Hotline: ${siteConfig.contact.hotlineLabel} hoặc Phòng kinh doanh: ${siteConfig.contact.businessRoomLabel} để chuyên viên Đông Phú Gia tư vấn chi tiết hơn ạ!`;

const INITIAL_MESSAGE = `Chào anh/chị! Em là trợ lý ảo của Đông Phú Gia. Anh/chị cần tư vấn về thiết bị vệ sinh, nhà bếp hay gạch ốp lát ạ? (Hotline hỗ trợ nhanh: ${siteConfig.contact.hotlineLabel})`;

// --- Types ---
type Message = {
    id: string;
    sender: "bot" | "user";
    text: string;
    timestamp: number;
};

interface ChatboxWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChatboxWidget({ isOpen, onClose }: ChatboxWidgetProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load history from sessionStorage
    useEffect(() => {
        const stored = sessionStorage.getItem("dpg_chat_history");
        if (stored) {
            try {
                setMessages(JSON.parse(stored));
            } catch (e) {
                setMessages([{ id: "msg_0", sender: "bot", text: INITIAL_MESSAGE, timestamp: Date.now() }]);
            }
        } else {
            setMessages([{ id: "msg_0", sender: "bot", text: INITIAL_MESSAGE, timestamp: Date.now() }]);
        }
    }, []);

    // Save history to sessionStorage
    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem("dpg_chat_history", JSON.stringify(messages));
        }
    }, [messages]);

    // Scroll to bottom
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isTyping, isOpen]);

    const handleSend = () => {
        const text = inputValue.trim();
        if (!text) return;

        // Add user message
        const userMsg: Message = { id: Date.now().toString(), sender: "user", text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setIsTyping(true);

        // Process bot response
        setTimeout(() => {
            const lowerText = text.toLowerCase();
            let matchedResponse = FALLBACK_RESPONSE;

            for (const rule of KNOWLEDGE_BASE) {
                if (rule.keywords.some(kw => lowerText.includes(kw))) {
                    matchedResponse = rule.response;
                    break;
                }
            }

            const botMsg: Message = { id: (Date.now() + 1).toString(), sender: "bot", text: matchedResponse, timestamp: Date.now() + 1 };
            setMessages(prev => [...prev, botMsg]);
            setIsTyping(false);
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="absolute bottom-20 right-0 w-[350px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col z-50 origin-bottom-right animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#2E7A96] p-4 flex items-center justify-between text-white shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-[15px] leading-tight">Đông Phú Gia</span>
                        <span className="text-[11px] text-white/80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Đang trực tuyến
                        </span>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 h-[360px] max-h-[50vh] overflow-y-auto p-4 flex flex-col gap-4 bg-[#F8F9FA] scrollbar-thin scrollbar-thumb-stone-300">
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={cn(
                            "flex max-w-[85%] gap-2",
                            msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                    >
                        {/* Avatar */}
                        <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1">
                            {msg.sender === "bot" ? (
                                <div className="w-full h-full bg-[#2E7A96] rounded-full flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                            ) : (
                                <div className="w-full h-full bg-stone-200 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-stone-500" />
                                </div>
                            )}
                        </div>

                        {/* Bubble */}
                        <div className={cn(
                            "p-3 rounded-2xl text-[13px] leading-relaxed",
                            msg.sender === "user" 
                                ? "bg-[#2E7A96] text-white rounded-tr-sm" 
                                : "bg-white text-stone-800 border border-stone-100 shadow-sm rounded-tl-sm"
                        )}>
                            {msg.text}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex mr-auto max-w-[85%] gap-2">
                        <div className="shrink-0 w-7 h-7 bg-[#2E7A96] rounded-full flex items-center justify-center mt-1">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white border border-stone-100 shadow-sm flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions / Hotlines */}
            <div className="px-4 py-2 bg-white border-t border-stone-100 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <a href={`tel:${siteConfig.contact.hotline.split('-')[0]}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-full text-[11px] font-semibold shrink-0 hover:bg-rose-100 transition-colors">
                    <Phone className="w-3 h-3" /> Gọi Hotline
                </a>
                <button onClick={() => setInputValue("Xin báo giá")} className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-full text-[11px] font-medium shrink-0 hover:bg-stone-200 transition-colors">
                    Xin báo giá
                </button>
                <button onClick={() => setInputValue("Địa chỉ ở đâu?")} className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-full text-[11px] font-medium shrink-0 hover:bg-stone-200 transition-colors">
                    Địa chỉ
                </button>
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-stone-200 flex items-end gap-2">
                <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 max-h-[80px] min-h-[40px] text-[13px] resize-none bg-stone-100 border-transparent rounded-xl focus:bg-white focus:border-[#2E7A96] focus:ring-1 focus:ring-[#2E7A96] p-2.5 scrollbar-thin transition-all outline-none"
                    rows={1}
                />
                <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="p-2.5 bg-[#2E7A96] text-white rounded-xl hover:bg-[#205b73] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
