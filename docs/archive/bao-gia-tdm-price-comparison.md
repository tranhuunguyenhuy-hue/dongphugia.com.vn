# Báo giá: So sánh giá TDM + Hita → Import giá tốt nhất vào DPG

---

Chào anh/chị,

Dưới đây là báo giá cho hạng mục **tích hợp nguồn giá thứ 2 (tdm.vn)** và tự động so sánh để luôn hiển thị giá tốt nhất trên website Đông Phú Gia.

---

## Mô tả công việc

Hiện tại hệ thống đang lấy giá từ **hita.com.vn**. Yêu cầu mới là bổ sung thêm nguồn **tdm.vn**, so sánh giá từng sản phẩm giữa 2 nguồn, và tự động lấy giá thấp hơn import vào database.

---

## Chi tiết kỹ thuật

**Phase A — TOTO (ưu tiên trước)**

- Recon cấu trúc trang tdm.vn: xác định DOM selectors, URL pattern, format SKU
- Build crawler lấy giá TOTO từ tdm.vn (dùng Playwright — cần thiết vì tdm render JS)
- Logic so sánh: match sản phẩm theo **mã SKU hãng** (cùng chuẩn với hita), so sánh giá, lấy giá thấp hơn
- Xử lý edge case: SKU có nhiều variant (màu/size), giá theo đơn vị khác nhau
- Upsert vào database DPG, verify kết quả trên 50+ sản phẩm mẫu

> *Lý do cần xử lý kỹ: cùng 1 mã SKU, TDM có thể list nhiều mức giá theo variant. Map sai là giá hiển thị sai → rủi ro kinh doanh trực tiếp.*

**Phase B — Toàn bộ brand còn lại**

- Mở rộng pipeline Phase A sang các brand đã có trên hệ thống (INAX, Caesar, Viglacera,...)
- Chạy batch so sánh + cập nhật toàn bộ catalog

---

## Thời gian thực hiện

| Phase | Thời gian |
|-------|-----------|
| Phase A (TOTO) | 3–4 ngày làm việc |
| Phase B (toàn bộ brand) | 2–3 ngày làm việc |
| **Tổng** | **~5–7 ngày** |

---

## Báo giá

| Hạng mục | Giá |
|----------|-----|
| Phase A — TOTO | 2.000.000đ |
| Phase B — Toàn bộ brand | 1.500.000đ |
| **Tổng trọn gói** | **3.500.000đ** |

*(Có thể thanh toán theo phase — Phase A xong, verify ổn mới triển khai Phase B)*

---

## So sánh với hạng mục tương đương

Hạng mục **Crawl & làm sạch dữ liệu từ hita.com.vn** (build pipeline từ đầu, 1 nguồn) đã được thực hiện với giá **6.000.000đ**.

Hạng mục này tận dụng toàn bộ hạ tầng đã có, chỉ bổ sung logic nguồn thứ 2 và so sánh giá — nên chi phí thấp hơn ~40%.

---

Anh/chị có câu hỏi gì thêm vui lòng phản hồi. Team sẵn sàng bắt đầu ngay khi có xác nhận.

Trân trọng,  
**Đông Phú Gia Team**
