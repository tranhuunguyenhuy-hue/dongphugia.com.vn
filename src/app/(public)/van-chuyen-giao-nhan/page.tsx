import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Chính sách Vận chuyển & Giao nhận',
    description: 'Chính sách về vận chuyển và giao nhận hàng hóa tại Đông Phú Gia.',
}

export default function DeliveryPolicyPage() {
    return (
        <article className="prose prose-stone max-w-4xl mx-auto py-16 px-6 sm:px-8 lg:px-12 prose-headings:font-semibold prose-a:text-brand-600">
            <h1>THÔNG TIN VỀ VẬN CHUYỂN VÀ GIAO NHẬN</h1>
            <p className="lead font-medium text-stone-600">CÔNG TY TNHH ĐÔNG PHÚ GIA</p>
            <p>
                Do đặc thù hoạt động trong lĩnh vực vật liệu xây dựng, gạch ốp lát, thiết bị vệ sinh, thiết bị bếp và các sản phẩm hoàn thiện công trình, việc vận chuyển và giao nhận tại Công ty TNHH Đông Phú Gia được thực hiện theo từng đơn hàng, từng loại hàng hóa và thỏa thuận cụ thể với khách hàng. Chính sách này nhằm công khai phương thức giao nhận, trách nhiệm của các bên và cách xử lý các vấn đề phát sinh trong quá trình mua bán hàng hóa.
            </p>

            <h2>1. Phạm vi áp dụng</h2>
            <ul>
                <li>Chính sách này áp dụng đối với các giao dịch mua bán sản phẩm tại showroom, qua website, qua điện thoại, email, tin nhắn hoặc các kênh liên hệ chính thức của Công ty TNHH Đông Phú Gia.</li>
                <li>Nhóm hàng hóa áp dụng gồm: gạch ốp lát, vật liệu hoàn thiện, thiết bị vệ sinh, thiết bị phòng tắm, thiết bị bếp, phụ kiện liên quan và các sản phẩm khác do công ty phân phối.</li>
                <li>Đối với đơn hàng có hợp đồng riêng, điều khoản vận chuyển và giao nhận được thực hiện theo hợp đồng hoặc báo giá đã được hai bên xác nhận.</li>
            </ul>

            <h2>2. Khu vực và hình thức giao hàng</h2>
            <ul>
                <li>Đông Phú Gia hỗ trợ giao hàng tại địa chỉ do khách hàng cung cấp, bao gồm nhà ở, công trình, khách sạn, biệt thự, văn phòng, kho hàng hoặc địa điểm nhận hàng khác theo thỏa thuận.</li>
                <li>Khu vực giao hàng, thời gian giao hàng và chi phí vận chuyển được xác định căn cứ vào địa chỉ nhận hàng, khối lượng, kích thước, chủng loại sản phẩm và điều kiện giao nhận thực tế.</li>
                <li>Khách hàng cũng có thể nhận hàng trực tiếp tại showroom/kho của Đông Phú Gia sau khi đơn hàng được xác nhận và hàng hóa sẵn sàng bàn giao.</li>
            </ul>

            <h2>3. Thời gian giao hàng</h2>
            <ul>
                <li>Thời gian giao hàng được thông báo cho khách hàng sau khi xác nhận tình trạng hàng hóa, số lượng, phương thức thanh toán và địa điểm giao nhận.</li>
                <li>Đối với hàng có sẵn, công ty sẽ sắp xếp giao hàng theo lịch phù hợp với khách hàng và điều kiện vận chuyển thực tế.</li>
                <li>Đối với hàng đặt theo mẫu, hàng nhập, hàng số lượng lớn hoặc hàng phục vụ công trình, thời gian giao hàng có thể phụ thuộc vào lịch nhập hàng, tiến độ cung ứng của nhà sản xuất/nhà phân phối và thỏa thuận cụ thể trong báo giá hoặc hợp đồng.</li>
                <li>Trường hợp có thay đổi về thời gian giao hàng do yếu tố khách quan như thời tiết, giao thông, thiếu hàng tạm thời, chậm nhập hàng hoặc sự kiện bất khả kháng, công ty sẽ thông báo kịp thời cho khách hàng.</li>
            </ul>

            <h2>4. Chi phí vận chuyển</h2>
            <ul>
                <li>Chi phí vận chuyển được thông báo trước cho khách hàng, căn cứ vào khoảng cách giao hàng, khối lượng, kích thước, số tầng, điều kiện bốc xếp, yêu cầu xe chuyên dụng và các yếu tố phát sinh nếu có.</li>
                <li>Một số đơn hàng có thể được hỗ trợ vận chuyển theo chính sách bán hàng từng thời điểm hoặc theo thỏa thuận riêng giữa công ty và khách hàng.</li>
                <li>Các chi phí phát sinh ngoài thỏa thuận ban đầu như thay đổi địa điểm giao hàng, chờ giao hàng quá lâu, bốc xếp lên tầng cao, thuê phương tiện đặc biệt hoặc giao hàng ngoài giờ sẽ được hai bên thống nhất trước khi thực hiện.</li>
            </ul>

            <h2>5. Quy trình xác nhận đơn hàng và giao nhận</h2>
            <ul>
                <li>Sau khi khách hàng đặt hàng hoặc yêu cầu báo giá, Đông Phú Gia sẽ xác nhận thông tin sản phẩm, số lượng, đơn giá, tổng giá trị đơn hàng, thời gian dự kiến giao hàng và địa điểm giao nhận.</li>
                <li>Đơn hàng chỉ được xem là xác nhận khi khách hàng đồng ý với báo giá/đơn hàng và hoàn tất các điều kiện thanh toán hoặc đặt cọc theo thỏa thuận.</li>
                <li>Khi giao hàng, khách hàng hoặc người được ủy quyền nhận hàng cần kiểm tra số lượng, chủng loại, mã sản phẩm, tình trạng bao bì và tình trạng hàng hóa trước khi ký nhận.</li>
                <li>Việc ký nhận hàng hóa là căn cứ xác nhận hàng đã được bàn giao theo thỏa thuận, trừ các lỗi kỹ thuật, lỗi nhà sản xuất hoặc vấn đề bảo hành được phát hiện sau đó theo chính sách riêng của từng sản phẩm.</li>
            </ul>

            <h2>6. Kiểm tra hàng hóa khi nhận</h2>
            <ul>
                <li>Khách hàng có trách nhiệm kiểm tra hàng hóa ngay tại thời điểm nhận hàng, đặc biệt đối với các mặt hàng dễ vỡ, dễ trầy xước hoặc có yêu cầu đồng bộ về mẫu mã, màu sắc, kích thước và lô sản xuất.</li>
                <li>Trường hợp phát hiện hàng hóa bị bể vỡ, móp méo, sai mẫu, sai số lượng hoặc có dấu hiệu bất thường, khách hàng cần thông báo ngay cho nhân viên giao hàng hoặc bộ phận phụ trách đơn hàng để được ghi nhận và xử lý.</li>
                <li>Đối với gạch ốp lát và vật liệu hoàn thiện, khách hàng nên kiểm tra kỹ mã hàng, kích thước, tông màu, lô sản xuất và số lượng trước khi thi công. Công ty không chịu trách nhiệm đối với các sai lệch phát sinh do khách hàng đã đưa hàng vào sử dụng/thi công mà không kiểm tra trước.</li>
            </ul>

            <h2>7. Trách nhiệm của Đông Phú Gia</h2>
            <ul>
                <li>Cung cấp thông tin đơn hàng, lịch giao hàng và điều kiện giao nhận một cách rõ ràng trước khi thực hiện giao hàng.</li>
                <li>Đóng gói, sắp xếp và vận chuyển hàng hóa phù hợp với đặc tính của từng loại sản phẩm nhằm hạn chế rủi ro hư hỏng trong quá trình giao nhận.</li>
                <li>Hỗ trợ khách hàng xử lý các trường hợp giao nhầm hàng, thiếu hàng, hàng bị hư hỏng trong quá trình vận chuyển do lỗi thuộc về công ty hoặc đơn vị vận chuyển do công ty chỉ định.</li>
                <li>Cung cấp hóa đơn, chứng từ, phiếu giao hàng hoặc các tài liệu liên quan theo quy định và theo yêu cầu hợp lý của khách hàng.</li>
            </ul>

            <h2>8. Trách nhiệm của khách hàng</h2>
            <ul>
                <li>Cung cấp chính xác thông tin người nhận, số điện thoại, địa chỉ giao hàng, thời gian nhận hàng và các yêu cầu đặc biệt liên quan đến giao nhận.</li>
                <li>Bố trí người nhận hàng đúng thời gian đã thống nhất; kiểm tra hàng hóa trước khi ký nhận.</li>
                <li>Thanh toán đầy đủ các khoản tiền hàng, phí vận chuyển, phí bốc xếp hoặc chi phí phát sinh khác theo thỏa thuận.</li>
                <li>Thông báo kịp thời cho Đông Phú Gia nếu có thay đổi về địa chỉ nhận hàng, thời gian nhận hàng hoặc người nhận hàng.</li>
            </ul>

            <h2>9. Giao nhận hóa đơn và chứng từ</h2>
            <ul>
                <li>Hóa đơn giá trị gia tăng, phiếu giao hàng, phiếu thu hoặc chứng từ liên quan sẽ được lập theo thông tin khách hàng cung cấp và theo quy định pháp luật hiện hành.</li>
                <li>Chứng từ có thể được giao trực tiếp cùng hàng hóa, gửi qua email, gửi bản điện tử hoặc bàn giao tại showroom theo thỏa thuận với khách hàng.</li>
                <li>Khách hàng cần cung cấp thông tin xuất hóa đơn chính xác trước thời điểm lập hóa đơn. Trường hợp thông tin cung cấp sai hoặc chậm, việc điều chỉnh hóa đơn sẽ thực hiện theo quy định pháp luật và khả năng xử lý thực tế.</li>
            </ul>

            <h2>10. Xử lý khiếu nại liên quan đến vận chuyển và giao nhận</h2>
            <ul>
                <li>Mọi khiếu nại liên quan đến giao nhầm hàng, thiếu hàng, hàng hư hỏng khi giao nhận hoặc chứng từ giao hàng cần được phản hồi trong thời gian sớm nhất kể từ khi nhận hàng.</li>
                <li>Đông Phú Gia sẽ tiếp nhận thông tin, kiểm tra chứng từ, hình ảnh, biên bản giao nhận và các dữ liệu liên quan để đưa ra phương án xử lý phù hợp.</li>
                <li>Tùy từng trường hợp, phương án xử lý có thể bao gồm giao bổ sung, đổi hàng, hỗ trợ bảo hành, điều chỉnh chứng từ hoặc các giải pháp khác theo thỏa thuận giữa hai bên.</li>
            </ul>

            <hr className="my-10" />

            <h3>Thông tin liên hệ chính thức</h3>
            <p className="font-semibold">CÔNG TY TNHH ĐÔNG PHÚ GIA</p>
            <ul>
                <li><strong>Địa chỉ:</strong> 275 Phan Đình Phùng, Phường Xuân Hương - Đà Lạt, Tỉnh Lâm Đồng, Việt Nam</li>
                <li><strong>Điện thoại/Hotline:</strong> <a href="tel:02633520316">02633520316</a></li>
                <li><strong>Email:</strong> <a href="mailto:vlxd.dongphu@gmail.com">vlxd.dongphu@gmail.com</a></li>
                <li><strong>Website:</strong> <a href="https://www.dongphugia.com.vn">https://www.dongphugia.com.vn</a></li>
            </ul>
        </article>
    )
}
