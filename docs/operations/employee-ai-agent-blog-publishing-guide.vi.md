# Hướng dẫn nhân viên vận hành AI Agent để viết và xuất bản bài blog

Tài liệu này dành cho nhân viên Content, SEO, Marketing và vận hành dự án Đông
Phú Gia. Mục tiêu là giúp bạn giao việc cho AI Agent, kiểm tra kết quả và đưa
bài viết lên website mà không cần biết về API, mã nguồn hay cơ sở dữ liệu.

> Đây là hướng dẫn **vận hành nội dung**. Nhân viên kỹ thuật dùng
> [Publishing API v1 Integration Guide](../integration/publishing-api-v1-integration-guide.vi.md)
> và OpenAPI để xây dựng hoặc bảo trì kết nối. Tài liệu này bổ sung, không thay
> thế hai tài liệu kỹ thuật đó.

## 1. AI Agent hỗ trợ bạn như thế nào?

Có thể hình dung quy trình gồm ba vai trò:

- **AI Agent** nghiên cứu chủ đề, đề xuất cấu trúc, viết nội dung, chuẩn bị hình
  ảnh và thực hiện lệnh lưu hoặc xuất bản mà bạn giao.
- **Publishing API** là cổng an toàn đưa nội dung từ AI Agent vào website Đông
  Phú Gia. Hệ thống kiểm tra quyền, danh mục, hình ảnh và điều kiện xuất bản.
- **Nhân viên phụ trách nội dung** quyết định chủ đề, kiểm tra chất lượng và chọn
  lưu bản nháp, xuất bản ngay hoặc hẹn lịch.

AI Agent không tự quyết định thông tin nào là đúng với thương hiệu. Bạn vẫn là
người chịu trách nhiệm kiểm tra sản phẩm, chính sách, thông điệp, hình ảnh và
thời điểm xuất bản.

### Trước khi bắt đầu

Bạn cần được quản trị viên xác nhận rằng:

- AI Agent đã được kết nối với môi trường production;
- tài khoản Agent còn hiệu lực và có quyền tạo nội dung, tải hình và xuất bản;
- bạn đang sử dụng đúng AI Agent dành cho Đông Phú Gia; và
- kênh liên hệ Technical Owner đã được thống nhất.

Nếu Agent đã được cấu hình sẵn, bạn chỉ cần giao việc bằng lời nói thông thường.
Không nhập lệnh kỹ thuật và không tự cấu hình credential.

## 2. Quy trình làm nội dung hằng ngày

```text
Nghiên cứu chủ đề
        ↓
Tạo bản nháp bài viết
        ↓
Kiểm tra chất lượng nội dung
        ↓
Chuẩn bị và tải hình ảnh
        ↓
Xuất bản ngay hoặc hẹn lịch
        ↓
Kiểm tra bài viết công khai
```

### Bước 1 — Nghiên cứu chủ đề

Giao cho Agent mục tiêu rõ ràng: nhóm khách hàng, nhu cầu tìm kiếm, sản phẩm hoặc
dịch vụ liên quan và kết quả bạn mong muốn.

Bạn cần kiểm tra:

- chủ đề có phục vụ khách hàng của Đông Phú Gia hay không;
- có trùng với bài đã xuất bản hoặc bản nháp đang làm hay không;
- nguồn thông tin có đáng tin cậy và còn cập nhật hay không; và
- các website được trích dẫn có thuộc danh sách đã được duyệt hay không.

### Bước 2 — Tạo bản nháp

Yêu cầu Agent viết bài và **lưu ở chế độ Bản nháp**. Cung cấp từ khóa chính,
ý định tìm kiếm, đối tượng đọc, độ dài mong muốn và lời kêu gọi hành động.

Không yêu cầu xuất bản ngay ở lần viết đầu tiên. Bản nháp cho phép bạn kiểm tra
và sửa nội dung trước khi bài xuất hiện công khai.

### Bước 3 — Kiểm tra chất lượng

Đọc toàn bộ bài như một khách hàng. Đối chiếu thông tin sản phẩm, thương hiệu,
giá, chính sách và thông tin liên hệ với nguồn nội bộ đang có hiệu lực. Dùng
checklist tại mục 4 trước khi duyệt xuất bản.

Nếu cần sửa, hãy mô tả cụ thể đoạn nào sai và kết quả mong muốn. Không chỉ nói
“viết hay hơn” hoặc “tối ưu SEO hơn”.

### Bước 4 — Chuẩn bị hình ảnh

Mỗi bài cần ít nhất:

- một ảnh đại diện thu nhỏ (thumbnail); và
- một ảnh bìa (cover).

Chỉ dùng hình ảnh được phép sử dụng, đúng sản phẩm và không chứa thông tin gây
hiểu nhầm. Agent có thể tải hình JPG, PNG hoặc WebP; mỗi file không quá 5 MiB.
Không yêu cầu Agent lấy trực tiếp ảnh từ một website bên ngoài để gắn vào bài.

Sau khi Agent báo tải ảnh thành công, yêu cầu Agent xác nhận cả thumbnail và
cover đã được gắn đúng vị trí.

### Bước 5 — Xuất bản hoặc hẹn lịch

Sau khi checklist đạt yêu cầu, chọn một trong ba chế độ ở mục 5. Khi hẹn lịch,
ghi rõ ngày, giờ và múi giờ Việt Nam. Ví dụ: “09:00 ngày 25/08/2026, giờ Việt
Nam”.

### Bước 6 — Kiểm tra bài công khai

Sau khi Agent báo đã xuất bản:

1. Mở đường dẫn bài viết do Agent trả về.
2. Kiểm tra tiêu đề, ảnh bìa, nội dung, liên kết và bố cục trên máy tính.
3. Kiểm tra nhanh trên điện thoại.
4. Xác nhận bài thuộc đúng danh mục.
5. Kiểm tra bài đã xuất hiện trong trang Blog hoặc trang danh mục phù hợp.

Nếu bài hẹn lịch chưa xuất hiện đúng phút đã chọn, chờ tối đa 5 phút rồi kiểm
tra lại một lần. Nếu vẫn chưa có, liên hệ Technical Owner; không tạo một bài mới
giống hệt để “thử lại”.

## 3. Cách giao việc cho AI Agent

Một yêu cầu tốt nên có: mục tiêu, đối tượng đọc, chủ đề, từ khóa, thông tin bắt
buộc, điều cần tránh và hành động cuối cùng.

### Ví dụ: nghiên cứu chủ đề

> Hãy nghiên cứu chủ đề “cách chọn thiết bị vệ sinh cho phòng tắm nhỏ” cho khách
> hàng gia đình tại Đà Lạt. Liệt kê ý định tìm kiếm, câu hỏi thường gặp, dàn ý đề
> xuất và các nguồn đáng tin cậy. Chưa viết bài và chưa xuất bản. Chỉ sử dụng
> website trích dẫn đã được Đông Phú Gia cho phép; nếu nguồn chưa được phép, hãy
> báo cho tôi thay vì tự chèn liên kết.

### Ví dụ: viết bài SEO và lưu bản nháp

> Dựa trên dàn ý đã duyệt, viết bài SEO về cách chọn thiết bị vệ sinh cho phòng
> tắm nhỏ. Đối tượng đọc là gia đình đang sửa nhà. Từ khóa chính là “thiết bị vệ
> sinh phòng tắm nhỏ”. Giọng văn tư vấn rõ ràng, không phóng đại. Đề xuất tiêu đề,
> mô tả ngắn, các heading, câu hỏi thường gặp và lời kêu gọi liên hệ Đông Phú
> Gia. Chọn danh mục phù hợp từ danh sách hiện có và lưu thành Bản nháp. Không
> xuất bản.

### Ví dụ: sửa bản nháp

> Mở bản nháp “Thiết bị vệ sinh cho phòng tắm nhỏ”. Sửa phần lựa chọn kích thước
> theo ghi chú của tôi, bỏ mọi khẳng định chưa có nguồn và rút gọn phần mở đầu.
> Giữ nguyên danh mục, kiểm tra lại liên kết và lưu lại Bản nháp. Chưa xuất bản.

### Ví dụ: chuẩn bị cập nhật một bài đã công khai

> Đánh giá bài đang công khai “Thiết bị vệ sinh cho phòng tắm nhỏ” và đề xuất
> nội dung cần cập nhật. Trước tiên chỉ gửi cho tôi danh sách thay đổi, chưa cập
> nhật bài. Sau khi tôi xác nhận, hãy áp dụng đúng các thay đổi đã duyệt và xuất
> bản bản cập nhật ngay.

### Ví dụ: xuất bản ngay

> Tôi đã hoàn tất checklist nội dung cho bản nháp “Thiết bị vệ sinh cho phòng
> tắm nhỏ”. Hãy kiểm tra lại thumbnail, cover, danh mục và các liên kết. Nếu mọi
> điều kiện đều đạt, xuất bản ngay và gửi lại đường dẫn bài công khai. Nếu có lỗi,
> dừng lại và báo rõ mục cần sửa.

### Ví dụ: hẹn lịch

> Tôi đã duyệt bản nháp “Thiết bị vệ sinh cho phòng tắm nhỏ”. Hãy hẹn xuất bản
> lúc 09:00 ngày 25/08/2026, giờ Việt Nam. Xác nhận lại tên bài và thời điểm đã
> hẹn. Sau thời điểm đó, kiểm tra bài công khai và gửi lại đường dẫn.

## 4. Checklist chất lượng trước khi xuất bản

Chỉ yêu cầu xuất bản khi tất cả mục cần thiết bên dưới đã đạt.

### Thông tin và thương hiệu

- [ ] Thông tin có nguồn rõ ràng, hợp lý và còn hiệu lực.
- [ ] Tên thương hiệu, tên sản phẩm và thông số được viết đúng.
- [ ] Không tự tạo giá, khuyến mãi, bảo hành, chứng nhận hoặc cam kết.
- [ ] Nội dung không gây hiểu nhầm rằng AI Agent là chuyên gia hoặc đại diện pháp
      lý của Đông Phú Gia.
- [ ] Thông tin liên hệ và lời kêu gọi hành động đúng với quy định hiện hành.

### SEO và ý định tìm kiếm

- [ ] Bài trả lời đúng nhu cầu của người tìm kiếm, không chỉ lặp lại từ khóa.
- [ ] Tiêu đề rõ ràng, tự nhiên và phản ánh đúng nội dung.
- [ ] Mô tả ngắn nêu được lợi ích chính của bài.
- [ ] Heading được sắp xếp hợp lý và dễ đọc.
- [ ] Từ khóa chính và từ khóa liên quan được dùng tự nhiên.
- [ ] Bài không trùng hoặc cạnh tranh không cần thiết với nội dung đã có.

### Hình ảnh

- [ ] Có thumbnail và cover.
- [ ] Hình đúng sản phẩm/chủ đề, rõ nét và có quyền sử dụng.
- [ ] Không có watermark, giá, logo hoặc chữ sai.
- [ ] Chú thích hoặc ngữ cảnh hình ảnh không gây hiểu nhầm.

### Liên kết

- [ ] Mỗi liên kết dẫn tới đúng nội dung được nhắc đến.
- [ ] Không có liên kết hỏng hoặc chuyển hướng đáng ngờ.
- [ ] Chỉ dùng hostname đã được Đông Phú Gia duyệt.
- [ ] Không chèn hình ảnh từ website bên ngoài bằng liên kết trực tiếp.

### Trình bày và tuân thủ

- [ ] Đoạn văn ngắn, dễ đọc; danh sách và heading dùng nhất quán.
- [ ] Không còn ghi chú nội bộ, câu lệnh cho AI hoặc nội dung mẫu.
- [ ] Không có dữ liệu cá nhân, credential, thông tin mật hoặc nội dung chưa được
      phép công khai.
- [ ] Nội dung tuân thủ bản quyền, chính sách thương hiệu và quy định pháp luật.
- [ ] Đã chọn đúng danh mục có sẵn trên website.

## 5. Chọn chế độ xuất bản

| Chế độ | Khi nên dùng | Điều nhân viên cần làm |
| --- | --- | --- |
| **Bản nháp** | Bài mới viết, còn cần kiểm tra hoặc cần người khác góp ý. | Yêu cầu Agent lưu Bản nháp; đọc và sửa trước khi xuất bản. |
| **Xuất bản ngay** | Nội dung đã qua checklist và cần xuất hiện ngay trên website. | Xác nhận rõ tên bài, yêu cầu Agent xuất bản, sau đó mở đường dẫn công khai để kiểm tra. |
| **Hẹn lịch** | Bài phục vụ chiến dịch, lịch SEO hoặc thời điểm truyền thông cụ thể. | Ghi rõ ngày, giờ Việt Nam; kiểm tra lại lịch Agent xác nhận và kiểm tra bài sau thời điểm hẹn. |

Không dùng “Xuất bản ngay” để xem thử bài. Hãy dùng Bản nháp. Không tạo một bài
mới khi chỉ cần sửa bản nháp hiện có.

## 6. Vấn đề thường gặp và cách xử lý

| Vấn đề | Bạn nên làm gì? |
| --- | --- |
| Agent không thể đăng nhập hoặc báo credential không hợp lệ | Dừng thao tác. Kiểm tra bạn đang dùng đúng Agent đã được phê duyệt, sau đó liên hệ Technical Owner. Không yêu cầu Agent hiển thị credential. |
| Agent tạo được bản nháp nhưng không xuất bản được | Yêu cầu Agent nêu ngắn gọn điều kiện chưa đạt: nội dung, ảnh, danh mục, quyền hay hệ thống. Sửa mục được báo; nếu lỗi vẫn lặp lại, liên hệ Technical Owner. |
| Chọn sai danh mục | Yêu cầu Agent hiển thị các danh mục đang có, chọn lại danh mục đúng và cập nhật bản nháp. Không tự tạo tên danh mục mới. |
| Thiếu thumbnail hoặc cover | Chuẩn bị file ảnh hợp lệ và yêu cầu Agent tải lại, sau đó xác nhận ảnh đã gắn đúng vai trò. |
| Liên kết bị từ chối | Kiểm tra hostname có được phê duyệt hay không. Dùng nguồn đã được duyệt hoặc gửi yêu cầu xét duyệt nguồn mới cho người phụ trách. |
| Có nguy cơ trùng bài | Tạm dừng xuất bản. Yêu cầu Agent tìm trong cả bài công khai và bản nháp, rồi quyết định cập nhật bài cũ hoặc đổi góc nội dung. |
| Bài hẹn lịch chưa xuất hiện | Chờ tối đa 5 phút và tải lại trang một lần. Nếu vẫn chưa xuất hiện, liên hệ Technical Owner; không tạo lịch hoặc bài trùng. |
| Agent báo hệ thống tạm thời không sẵn sàng | Không thử liên tục. Chờ vài phút rồi thử lại đúng một lần; nếu vẫn lỗi, ghi lại thời điểm và bước đang làm để báo Technical Owner. |
| Bài đã công khai nhưng có lỗi nghiêm trọng | Ngừng giao thêm lệnh xuất bản và liên hệ ngay Technical Owner/Project Owner để xử lý. Không tự chia sẻ credential hoặc tìm cách can thiệp hệ thống. |

Khi báo lỗi, hãy cung cấp tên bài, thời điểm, thao tác đang thực hiện và thông báo
lỗi đã được rút gọn. Không gửi credential, nội dung bí mật hoặc dữ liệu cá nhân.

## 7. Quy tắc credential và bảo mật

Credential có thể hiểu đơn giản là “chìa khóa” riêng giúp AI Agent được phép làm
việc với website. Trong vận hành hằng ngày, nhân viên không cần xem hoặc sao
chép chìa khóa này.

### Nên làm

- Chỉ lưu credential trong password manager hoặc secret manager đã được dự án
  phê duyệt.
- Chỉ sử dụng AI Agent và thiết bị làm việc đã được phê duyệt.
- Liên hệ quản trị viên khi Agent báo credential sắp hết hạn hoặc cần rotation.
- Báo ngay cho Technical Owner nếu nghi ngờ credential đã bị lộ.

### Không được làm

- Không dán credential vào khung chat, prompt của AI, email hoặc tài liệu nội bộ
  thông thường.
- Không đưa credential vào mã nguồn, file cấu hình cá nhân, bảng tính hoặc ghi
  chú không được bảo vệ.
- Không chụp màn hình, in, đọc thành tiếng hoặc gửi credential cho người khác.
- Không dùng chung credential giữa các AI Agent.
- Không yêu cầu Agent hiển thị, nhắc lại hoặc kiểm tra credential cho bạn.

Nếu credential vô tình xuất hiện ở nơi không an toàn, coi như credential đã bị
lộ: dừng sử dụng và liên hệ Technical Owner để thu hồi, cấp lại.

## 8. Khi nào cần liên hệ Technical Owner?

Liên hệ Technical Owner hoặc quản trị viên Publishing API khi:

- AI Agent không kết nối được với hệ thống;
- xác thực thất bại hoặc credential hết hạn;
- lỗi tải hình, lưu bản nháp, xuất bản hoặc hẹn lịch vẫn còn sau một lần thử lại;
- bài hẹn lịch không xuất hiện sau thời gian chờ tối đa 5 phút;
- cần thêm hostname trích dẫn mới;
- cần thay đổi quyền, thu hồi hoặc rotation credential;
- nghi ngờ credential bị lộ;
- bài công khai có lỗi nghiêm trọng cần xử lý ngay; hoặc
- Agent đưa ra kết quả khác với trạng thái bạn nhìn thấy trên website.

### Thông tin nên gửi khi yêu cầu hỗ trợ

- tên bài hoặc chủ đề đang làm;
- bạn đang ở bước nào: Bản nháp, tải hình, xuất bản ngay hay hẹn lịch;
- thời điểm xảy ra lỗi;
- thông báo lỗi đã được rút gọn hoặc ảnh chụp màn hình không chứa thông tin mật;
- kết quả bạn mong muốn.

Không gửi credential, password, dữ liệu cá nhân hoặc toàn bộ log kỹ thuật.

## Tài liệu liên quan

- Nhân viên Content/SEO/Marketing: sử dụng tài liệu này cho công việc hằng ngày.
- Developer hoặc Technical Owner: sử dụng
  [Publishing API v1 Integration Guide](../integration/publishing-api-v1-integration-guide.vi.md)
  và [Production OpenAPI](https://www.dongphugia.vn/api/publishing/v1/openapi.json).

Khi hướng dẫn vận hành và tài liệu kỹ thuật khác nhau về cách kết nối hệ thống,
hãy dừng lại và hỏi Technical Owner. Nhân viên không tự sửa cấu hình hoặc dùng
lệnh kỹ thuật để xử lý.
