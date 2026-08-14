# Hướng dẫn vận hành Publishing cho AI Agent

Tài liệu này dành cho nhân viên nội bộ và người vận hành dự án sau khi một AI
Agent đã được kết nối với Publishing API của Đông Phú Gia.

Đông Phú Gia cung cấp API, xác thực, Machine Identity, kiểm tra nội dung kỹ
thuật và khả năng lưu, lên lịch hoặc xuất bản bài viết. Đông Phú Gia không cung
cấp hoặc quản lý AI Agent, chiến lược nội dung, SEO, nghiên cứu từ khóa hay kế
hoạch marketing. Người dùng tự tạo và quản lý AI Agent của mình; tài liệu
marketing và hướng dẫn prompt do đội Marketing/Content sở hữu.

Tài liệu này bổ sung, không thay thế [Publishing API v1 Integration
Guide](../integrations/publishing-api-v1-integration-guide.vi.md) và [Production
OpenAPI](https://www.dongphugia.vn/api/publishing/v1/openapi.json). Developer,
người xây dựng automation và Technical Owner dùng các tài liệu kỹ thuật đó để
kết nối hoặc bảo trì Agent.

## 1. AI Agent làm việc với Publishing API như thế nào?

AI Agent gửi nội dung và yêu cầu xuất bản qua kết nối đã được Technical Owner
cấu hình. Publishing API kiểm tra danh mục, hình ảnh, quyền, điều kiện xuất bản
và lưu trạng thái bài viết. Nhân viên vận hành theo dõi kết quả, kiểm tra bài
viết theo quy trình nội bộ của đội mình và quyết định khi nào yêu cầu Agent lưu
bản nháp, xuất bản ngay hoặc lên lịch.

Nhân viên không cần biết API, JSON, database hoặc deployment. Không tự sửa cấu
hình kết nối, không tự cấp quyền và không yêu cầu Agent hiển thị credential.

## 2. Các khả năng được cấp

Một Agent production được cấp riêng một Machine Identity và chỉ các capability
cần thiết cho integration đó. Phạm vi v1 thường gồm:

- `posts:write`: đọc taxonomy và tạo/cập nhật bài viết trong phạm vi Agent;
- `media:write`: tải Managed Media lên hệ thống; và
- `posts:publish`: xuất bản ngay hoặc tạo/thay đổi lịch xuất bản.

`posts:write` một mình không đủ để xuất bản. Global Publishing Gate, điều kiện
sẵn sàng, phiên bản bài viết và trạng thái hệ thống vẫn có thể chặn yêu cầu.
Nhân viên không tự mở Gate hoặc tự thêm capability.

## 3. Quy trình vận hành bài viết

1. Dùng AI Agent đã được Technical Owner phê duyệt và giao nội dung theo quy
   trình của đội Content/Marketing.
2. Yêu cầu Agent lưu bài ở **Bản nháp** trước khi xuất bản.
3. Kiểm tra kết quả theo checklist nội bộ của đội phụ trách nội dung, bao gồm
   tính chính xác, hình ảnh, liên kết và quyền công khai.
4. Yêu cầu Agent tải thumbnail, cover hoặc ảnh inline qua kết nối đã cấu hình.
5. Khi bài đã được duyệt nội bộ, yêu cầu **Xuất bản ngay** hoặc **Hẹn lịch**.
6. Mở đường dẫn công khai Agent trả về và xác nhận tiêu đề, hình ảnh, nội dung,
   danh mục và trạng thái hiển thị.

Nội dung, SEO, prompt, lịch chiến dịch và tiêu chuẩn giọng văn thuộc đội
Marketing/Content. Platform team chỉ chịu trách nhiệm về kết nối và khả năng
publish của API.

## 4. Giới hạn xuất bản cần biết

- Bài phải dùng taxonomy đang có; nhân viên không tự tạo danh mục hoặc tag mới.
- Hình ảnh phải được tải qua Managed Media và đáp ứng định dạng, kích thước,
  dung lượng mà API yêu cầu.
- Liên kết trích dẫn phải dùng hostname HTTPS đã được duyệt.
- Retry cùng một yêu cầu phải giữ nguyên khóa idempotency do Agent quản lý.
- Cập nhật đồng thời có thể bị từ chối nếu phiên bản bài viết đã thay đổi; không
  ghi đè mù, hãy yêu cầu Agent đọc lại trạng thái hiện tại.
- Lịch xuất bản có thể bị chặn nếu Gate, capability, credential hoặc điều kiện
  sẵn sàng không còn hợp lệ.

## 5. Xử lý vấn đề thường gặp

| Vấn đề | Xử lý an toàn |
| --- | --- |
| Agent không kết nối hoặc xác thực thất bại | Dừng thao tác, kiểm tra đang dùng đúng Agent đã được phê duyệt và liên hệ Technical Owner. Không yêu cầu hiển thị credential. |
| Tạo được bản nháp nhưng không xuất bản được | Ghi lại tên bài, thời điểm và bước bị lỗi; kiểm tra nội dung/hình ảnh theo quy trình nội bộ. Nếu lặp lại, chuyển Technical Owner. |
| Sai danh mục hoặc tag | Chọn taxonomy đã có và cập nhật bản nháp. Không tự tạo taxonomy mới. |
| Thiếu hoặc lỗi hình ảnh | Kiểm tra file nguồn và yêu cầu Agent tải lại qua Managed Media. Không hotlink ảnh ngoài. |
| Bài hẹn lịch chưa hiển thị | Kiểm tra lại sau tối đa 5 phút. Không tạo bài hoặc lịch trùng; nếu vẫn lỗi, báo Technical Owner. |
| Bài công khai có lỗi nghiêm trọng | Dừng các lệnh publish tiếp theo và báo ngay Technical Owner cùng người phụ trách nội dung. |

Khi báo lỗi, chỉ gửi tên bài, thao tác, thời điểm và thông báo đã rút gọn hoặc
ảnh chụp không chứa dữ liệu mật. Không gửi credential, password, token, log đầy
đủ hoặc dữ liệu cá nhân.

## 6. Quy tắc credential

- Credential chỉ được lưu trong password manager hoặc secret manager đã được
  phê duyệt.
- Không dán credential vào chat, prompt, email, issue, source code hoặc file
  không được bảo vệ.
- Không dùng chung credential giữa các Agent.
- Credential có thời hạn và phải rotation theo quy định của Technical Owner.
- Nếu nghi credential bị lộ, dừng sử dụng và báo ngay để revoke/rotate.

Nhân viên vận hành chỉ sử dụng Agent đã cấu hình sẵn. Việc cấp Machine Identity,
capability, credential và hostname allowlist thuộc Technical Owner/control
plane; không thực hiện bằng tài liệu này.

## 7. Khi nào cần chuyển Technical Owner?

Chuyển ngay khi API không khả dụng, xác thực thất bại, upload/publish/scheduler
tiếp tục lỗi sau lần thử hợp lý, cần rotation hoặc revoke credential, cần thêm
hostname citation, hoặc cần thay đổi capability. Technical Owner sẽ quyết định
việc kiểm tra hệ thống; nhân viên không tự thay đổi cấu hình Platform.

## Tài liệu theo ownership

- **Platform/Technical:** [Integration Guide](../integrations/publishing-api-v1-integration-guide.vi.md), Production OpenAPI, ADR và runbook triển khai.
- **Marketing/Content:** chiến lược nội dung, SEO, nghiên cứu từ khóa, prompt,
  lịch biên tập và tiêu chuẩn thương hiệu do đội Marketing/Content quản lý ở
  workspace riêng.
