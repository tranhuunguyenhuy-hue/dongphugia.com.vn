# Publishing Workflow Guide

**Audience:** AI Agent developers, automation builders và Technical Owner.

Publishing API hỗ trợ đọc taxonomy, tải Managed Media, tạo/cập nhật bản nháp,
publish ngay và lập lịch xuất bản. Mỗi mutation phải đáp ứng capability, quyền
Machine Identity, idempotency/concurrency và Publication Readiness; scheduler
kiểm tra lại các điều kiện trước khi làm bài công khai.

Quy trình request, payload, retry, ETag, giới hạn media và readiness được duy
trì trong [Publishing API v1 Integration Guide](publishing-api-v1-integration-guide.vi.md),
các mục “Quy trình nhanh”, “Publication Readiness” và “Retry, concurrency và
lỗi”.

Đây là khả năng xuất bản của Platform, không phải quy trình chiến lược nội dung,
SEO hoặc lịch marketing. Những quyết định đó thuộc đội sở hữu nội dung.
