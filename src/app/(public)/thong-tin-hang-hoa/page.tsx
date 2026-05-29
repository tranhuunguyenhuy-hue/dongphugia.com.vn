import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Thông tin về Hàng hóa & Dịch vụ',
    description: 'Thông tin về hàng hóa, dịch vụ và sản phẩm do Đông Phú Gia cung cấp.',
}

export default function ProductsInfoPage() {
    return (
        <article className="prose prose-stone max-w-4xl mx-auto py-16 px-6 sm:px-8 lg:px-12 prose-headings:font-semibold prose-a:text-brand-600">
            <h1>THÔNG TIN VỀ HÀNG HÓA, DỊCH VỤ</h1>
            <p className="lead font-medium text-stone-600">CÔNG TY TNHH ĐÔNG PHÚ GIA</p>
            <p>
                Website <a href="https://www.dongphugia.com.vn">https://www.dongphugia.com.vn</a> thuộc quyền sở hữu và quản lý của CÔNG TY TNHH ĐÔNG PHÚ GIA. Website được sử dụng để giới thiệu thông tin doanh nghiệp, hệ thống sản phẩm, dịch vụ tư vấn, chính sách bán hàng và các thông tin liên hệ chính thức của công ty. Các hàng hóa, dịch vụ được giới thiệu trên website thuộc nhóm vật liệu xây dựng, vật liệu hoàn thiện, thiết bị vệ sinh, thiết bị bếp và các giải pháp phục vụ hoàn thiện công trình.
            </p>

            <h2>1. Gạch ốp lát và vật liệu hoàn thiện</h2>
            <ul>
                <li>Cung cấp các dòng gạch lát nền, gạch ốp tường, gạch trang trí, gạch khổ lớn, vật liệu hoàn thiện và các sản phẩm phục vụ hoàn thiện không gian nhà ở, khách sạn, biệt thự, showroom, công trình dân dụng và thương mại.</li>
                <li>Sản phẩm được tư vấn theo nhu cầu sử dụng, diện tích, phong cách thiết kế, màu sắc, chất liệu, độ bền, khả năng chống trơn trượt, chống thấm và ngân sách của khách hàng.</li>
                <li>Thông tin sản phẩm trên website có thể bao gồm hình ảnh, mô tả, thương hiệu, quy cách, kích thước, xuất xứ, tình trạng hàng, khoảng giá tham khảo và các ghi chú kỹ thuật nếu có.</li>
            </ul>

            <h2>2. Thiết bị vệ sinh và phụ kiện phòng tắm</h2>
            <ul>
                <li>Cung cấp các sản phẩm thiết bị vệ sinh như bồn cầu, lavabo, sen vòi, vòi chậu, bồn tắm, cabin tắm, gương, phụ kiện phòng tắm và các thiết bị liên quan.</li>
                <li>Sản phẩm được phân phối theo nhiều phân khúc từ tiêu chuẩn đến cao cấp, phù hợp với nhà ở gia đình, căn hộ, biệt thự, khách sạn, homestay, resort và công trình dịch vụ.</li>
                <li>Đông Phú Gia hỗ trợ khách hàng lựa chọn thiết bị theo công năng sử dụng, diện tích không gian, phong cách thiết kế, thương hiệu, chính sách bảo hành và khả năng đồng bộ với các hạng mục hoàn thiện khác.</li>
            </ul>

            <h2>3. Thiết bị bếp và sản phẩm nội thất liên quan</h2>
            <ul>
                <li>Cung cấp các nhóm sản phẩm phục vụ không gian bếp như chậu rửa, vòi rửa, phụ kiện bếp, thiết bị bếp và các sản phẩm hoàn thiện liên quan đến khu vực bếp.</li>
                <li>Thông tin về sản phẩm được trình bày nhằm giúp khách hàng tham khảo trước khi đến showroom hoặc liên hệ nhân viên tư vấn để được báo giá cụ thể.</li>
                <li>Đối với từng công trình, công ty có thể tư vấn lựa chọn sản phẩm theo nhu cầu sử dụng thực tế, mức đầu tư, tính thẩm mỹ, độ bền và sự phù hợp với tổng thể không gian.</li>
            </ul>

            <h2>4. Dịch vụ tư vấn, báo giá và hỗ trợ lựa chọn sản phẩm</h2>
            <ul>
                <li>Đông Phú Gia hỗ trợ tư vấn sản phẩm trực tiếp tại showroom, qua điện thoại, email, website hoặc các kênh liên hệ trực tuyến của công ty.</li>
                <li>Khách hàng có thể gửi nhu cầu, bản vẽ, hình ảnh hiện trạng hoặc thông tin công trình để được hỗ trợ lựa chọn vật liệu, thiết bị và phương án phù hợp.</li>
                <li>Báo giá được lập dựa trên chủng loại sản phẩm, thương hiệu, số lượng, thời điểm cung ứng, chính sách khuyến mãi, điều kiện giao hàng và các yêu cầu cụ thể của khách hàng.</li>
            </ul>

            <h2>5. Dịch vụ đặt hàng, giao nhận và hỗ trợ sau bán hàng</h2>
            <ul>
                <li>Khách hàng có thể đặt hàng trực tiếp tại showroom hoặc thông qua website, hotline, email và các kênh liên hệ chính thức của Đông Phú Gia.</li>
                <li>Sau khi xác nhận đơn hàng, công ty sẽ thông tin cho khách hàng về sản phẩm, số lượng, giá trị đơn hàng, thời gian giao nhận, phương thức thanh toán và các điều kiện liên quan.</li>
                <li>Công ty hỗ trợ giao hàng theo thỏa thuận, xuất hóa đơn chứng từ theo thông tin khách hàng cung cấp và hướng dẫn khách hàng về chính sách bảo hành, đổi trả hoặc xử lý phát sinh nếu có.</li>
            </ul>

            <h2>6. Nguyên tắc công khai thông tin hàng hóa, dịch vụ</h2>
            <ul>
                <li>Thông tin trên website được công bố với mục đích giới thiệu, tham khảo và hỗ trợ khách hàng tìm hiểu sản phẩm, không thay thế cho báo giá, hợp đồng hoặc xác nhận giao dịch chính thức.</li>
                <li>Hình ảnh, màu sắc, mẫu mã và thông số sản phẩm trên website có thể có sai khác nhất định so với thực tế do điều kiện chụp ảnh, thiết bị hiển thị, thời điểm cập nhật hoặc thay đổi từ nhà sản xuất.</li>
                <li>Đông Phú Gia có quyền cập nhật, điều chỉnh hoặc thay đổi thông tin sản phẩm, giá bán, chính sách bán hàng và nội dung liên quan trên website để phù hợp với tình hình kinh doanh và quy định pháp luật.</li>
                <li>Khách hàng nên liên hệ trực tiếp với công ty để được xác nhận thông tin mới nhất trước khi đặt hàng, thanh toán hoặc ký kết giao dịch.</li>
            </ul>

            <hr className="my-10" />

            <h3>Thông tin liên hệ chính thức</h3>
            <p className="font-semibold">CÔNG TY TNHH ĐÔNG PHÚ GIA</p>
            <ul>
                <li><strong>Mã số doanh nghiệp:</strong> 5800929167</li>
                <li><strong>Địa chỉ:</strong> 275 Phan Đình Phùng, Phường Xuân Hương – Đà Lạt, Tỉnh Lâm Đồng, Việt Nam</li>
                <li><strong>Điện thoại/Hotline:</strong> <a href="tel:02633520316">02633520316</a></li>
                <li><strong>Email:</strong> <a href="mailto:vlxd.dongphu@gmail.com">vlxd.dongphu@gmail.com</a></li>
                <li><strong>Website:</strong> <a href="https://www.dongphugia.com.vn">https://www.dongphugia.com.vn</a></li>
            </ul>
        </article>
    )
}
