import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Thông tin về Giá',
    description: 'Chính sách và thông tin về giá bán các sản phẩm tại Đông Phú Gia.',
}

export default function PricingInfoPage() {
    return (
        <article className="prose prose-stone max-w-4xl mx-auto py-16 px-6 sm:px-8 lg:px-12 prose-headings:font-semibold prose-a:text-brand-600">
            <h1>THÔNG TIN VỀ GIÁ</h1>
            <p>
                Giá các sản phẩm, hàng hóa và dịch vụ được công bố trên website <a href="https://www.dongphugia.com.vn">https://www.dongphugia.com.vn</a> thuộc quyền sở hữu và quản lý của CÔNG TY TNHH ĐÔNG PHÚ GIA.
            </p>
            <p>
                Đông Phú Gia hoạt động trong lĩnh vực cung cấp vật liệu xây dựng, gạch ốp lát, thiết bị vệ sinh, thiết bị bếp, phụ kiện hoàn thiện công trình và các dịch vụ tư vấn, hỗ trợ liên quan. Do đặc thù sản phẩm đa dạng về thương hiệu, mẫu mã, xuất xứ, kích thước, số lượng và điều kiện giao nhận, giá bán có thể thay đổi theo từng thời điểm và theo nhu cầu cụ thể của khách hàng.
            </p>
            <p>
                Mọi mức giá thể hiện trên website, catalogue, bảng báo giá hoặc kênh tư vấn của Công ty được hiểu là giá tham khảo hoặc giá niêm yết tại thời điểm công bố. Báo giá chính thức sẽ được xác nhận trực tiếp với khách hàng trước khi giao dịch được thực hiện.
            </p>

            <h2>1. Nguyên tắc công bố và áp dụng giá</h2>
            <ul>
                <li>Giá sản phẩm được công bố căn cứ theo từng nhóm hàng, thương hiệu, quy cách, kích thước, chất liệu, xuất xứ và tình trạng hàng hóa tại thời điểm khách hàng yêu cầu.</li>
                <li>Đối với sản phẩm cần đặt hàng, sản phẩm nhập khẩu, sản phẩm theo bộ sưu tập riêng hoặc sản phẩm phục vụ dự án, giá bán sẽ được báo cụ thể theo đơn hàng thực tế.</li>
                <li>Giá có thể chưa bao gồm chi phí vận chuyển, bốc xếp, lắp đặt, phụ kiện phát sinh, thuế giá trị gia tăng hoặc các chi phí ngoài phạm vi bán hàng thông thường, trừ khi báo giá/hợp đồng thể hiện rõ đã bao gồm.</li>
                <li>Các chương trình ưu đãi, chiết khấu, khuyến mãi hoặc chính sách giá theo dự án được áp dụng theo từng thời điểm và theo điều kiện cụ thể do Công ty thông báo.</li>
            </ul>

            <h2>2. Giá nhóm gạch ốp lát và vật liệu hoàn thiện</h2>
            <ul>
                <li>Nhóm gạch ốp lát bao gồm gạch lát nền, gạch ốp tường, gạch trang trí, gạch khổ lớn và các vật liệu hoàn thiện liên quan.</li>
                <li>Giá được xác định theo thương hiệu, kích thước, bề mặt, chất liệu, số lượng đặt hàng, chi phí vận chuyển và tình trạng tồn kho.</li>
                <li>Đối với công trình nhà ở, khách sạn, biệt thự, resort hoặc dự án có số lượng lớn, Đông Phú Gia có thể lập báo giá riêng theo khối lượng, tiến độ giao hàng và điều kiện thanh toán.</li>
            </ul>

            <h2>3. Giá nhóm thiết bị vệ sinh và phụ kiện phòng tắm</h2>
            <ul>
                <li>Nhóm sản phẩm bao gồm bồn cầu, lavabo, sen vòi, bồn tắm, gương, phụ kiện phòng tắm và các thiết bị vệ sinh khác.</li>
                <li>Giá bán phụ thuộc vào thương hiệu, dòng sản phẩm, tính năng, chất liệu, chính sách bảo hành và các phụ kiện đi kèm.</li>
                <li>Trường hợp khách hàng mua theo bộ sản phẩm hoặc theo gói hoàn thiện phòng tắm, Công ty sẽ tư vấn phương án phù hợp và báo giá tổng thể theo nhu cầu sử dụng.</li>
            </ul>

            <h2>4. Giá nhóm thiết bị bếp và sản phẩm nội thất liên quan</h2>
            <ul>
                <li>Nhóm sản phẩm bao gồm chậu rửa, vòi bếp, thiết bị bếp, phụ kiện bếp và các sản phẩm hỗ trợ hoàn thiện không gian bếp.</li>
                <li>Giá được báo theo từng mã sản phẩm, thương hiệu, tính năng, quy cách kỹ thuật và chính sách bảo hành của nhà sản xuất hoặc nhà phân phối.</li>
                <li>Các hạng mục cần tư vấn phối hợp với thiết kế, lắp đặt hoặc giao hàng theo tiến độ công trình sẽ được báo giá cụ thể sau khi Công ty tiếp nhận đầy đủ yêu cầu của khách hàng.</li>
            </ul>

            <h2>5. Chi phí vận chuyển, giao nhận và lắp đặt</h2>
            <ul>
                <li>Chi phí vận chuyển được xác định theo địa điểm giao hàng, khối lượng hàng hóa, kích thước sản phẩm, phương tiện vận chuyển và điều kiện bốc xếp tại công trình.</li>
                <li>Đối với khu vực nội thành Đà Lạt hoặc các đơn hàng đủ điều kiện, Công ty có thể áp dụng chính sách hỗ trợ vận chuyển theo từng thời điểm.</li>
                <li>Chi phí lắp đặt, bốc xếp, nâng hạ, giao hàng ngoài giờ hoặc giao hàng đến địa điểm khó tiếp cận sẽ được thông báo trước để khách hàng xác nhận.</li>
            </ul>

            <h2>6. Thanh toán và xác nhận báo giá</h2>
            <ul>
                <li>Khách hàng có thể thanh toán bằng tiền mặt, chuyển khoản hoặc phương thức khác theo thỏa thuận với Công ty.</li>
                <li>Đối với đơn hàng cần đặt trước, Công ty có thể yêu cầu khách hàng đặt cọc theo tỷ lệ hoặc số tiền cụ thể được ghi nhận trong báo giá, đơn đặt hàng hoặc hợp đồng.</li>
                <li>Báo giá chỉ có hiệu lực trong thời hạn được ghi trên báo giá. Sau thời hạn này, Công ty có quyền cập nhật lại giá theo tình hình thực tế của thị trường và nguồn cung.</li>
                <li>Hóa đơn, chứng từ bán hàng được lập theo quy định pháp luật và theo thông tin khách hàng cung cấp.</li>
            </ul>

            <h2>7. Liên hệ báo giá chi tiết</h2>
            <p>Để nhận báo giá chính xác theo từng sản phẩm, số lượng, công trình hoặc nhu cầu sử dụng, khách hàng vui lòng liên hệ:</p>

            <hr className="my-10" />

            <h3>CÔNG TY TNHH ĐÔNG PHÚ GIA</h3>
            <ul>
                <li><strong>Địa chỉ:</strong> 275 Phan Đình Phùng, Phường Xuân Hương - Đà Lạt, Tỉnh Lâm Đồng, Việt Nam</li>
                <li><strong>Điện thoại/Hotline:</strong> <a href="tel:02633520316">02633520316</a></li>
                <li><strong>Email:</strong> <a href="mailto:vlxd.dongphu@gmail.com">vlxd.dongphu@gmail.com</a></li>
                <li><strong>Website:</strong> <a href="https://www.dongphugia.com.vn">https://www.dongphugia.com.vn</a></li>
            </ul>
        </article>
    )
}
