
import { Truck, CheckCircle2, Wrench, Newspaper } from 'lucide-react';

const values = [
    {
        icon: Truck,
        title: "Giao hàng nhanh chóng",
        description: "Hỗ trợ giao hàng nội thành trong ngày, toàn quốc đúng hẹn, đảm bảo nguyên vẹn và đúng mẫu mã."
    },
    {
        icon: CheckCircle2,
        title: "Cam kết chính hãng 100%",
        description: "Tất cả sản phẩm đều nhập khẩu trực tiếp từ thương hiệu uy tín, đầy đủ tem bảo hành và chứng từ."
    },
    {
        icon: Wrench,
        title: "Lắp đặt chuyên nghiệp",
        description: "Đội ngũ kỹ thuật viên tay nghề cao, lắp đặt chuẩn xác, thẩm mỹ và an toàn."
    },
    {
        icon: Newspaper, // Using Newspaper as proxy for "Transparency/Price List"
        title: "Giá tốt - báo giá minh bạch",
        description: "Cam kết giá cạnh tranh, minh bạch từng hạng mục, mang đến lựa chọn tối ưu cho mọi công trình."
    }
];

export function ValuesSection() {
    return (
        <section className="w-full rounded-3xl shadow-lg px-10 py-16 relative overflow-hidden bg-gradient-to-b from-[#dcfce7] via-[#f7fef1] to-[#fffef4]">
            <div className="text-center mb-16 space-y-2">
                <h2 className="text-4xl font-semibold text-[#15803d] tracking-tight">Đông Phú Gia</h2>
                <p className="text-3xl font-semibold text-[#14532d] tracking-tight">Đồng Hành - Phát Triển</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {values.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-8 items-start">
                        <div className="bg-[#15803d]/10 p-4 rounded-xl text-[#15803d]">
                            <item.icon className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-[#14532d] leading-8">{item.title}</h3>
                            <p className="text-base text-[#15803d] leading-6">{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
