# Tài liệu dự án Đông Phú Gia

Đây là mục lục canonical cho tài liệu được phép công khai cùng source code.

## Vận hành và kiến trúc

- [Agent reference](AGENTS.md): quy ước kỹ thuật và quy trình triển khai.
- [Handover](HANDOVER.md): kiến trúc, dữ liệu và hướng dẫn tiếp quản.
- [Design system](DESIGN_SYSTEM.md): token và quy ước giao diện.
- [Sitemap](SITEMAP.md): cấu trúc route và nội dung.
- [Crawl pipeline blueprint](CRAWL_PIPELINE_BLUEPRINT.md): kiến trúc crawler.

## Product requirements

- [PRD v2](prd/PRD-dongphugia-v2.md)
- [Admin CMS — phần 1](prd/admin-cms-part1.md)
- [Admin CMS — phần 2](prd/admin-cms-part2.md)
- [Catalog UX/data operating model](prd/catalog-ux-data-operating-model.md)

## Kế hoạch và handoff

- `plans/`: kế hoạch kỹ thuật có tên và phạm vi rõ ràng.
- `handoffs/`: kết quả bàn giao catalog/data còn giá trị vận hành.
- `archive/`: tài liệu lịch sử, không phải nguồn quyết định hiện tại.

Audit bảo mật, database dump, crawler snapshot và ghi chú nội bộ được lưu trong
repository private `dongphugia-internal`; không đưa các dữ liệu này vào repo
production public.
