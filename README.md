# Đông Phú Gia

Website catalogue và báo giá của Đông Phú Gia.

- Public production: `https://www.dongphugia.vn`
- Runtime: AWS EC2/Coolify với immutable ARM64 image
- Database production duy nhất: AWS PostgreSQL
- Media: Bunny CDN
- Default branch: `main`; repository policy requires PR, required CI, and PM
  merge approval. Verify GitHub branch-protection enforcement live before
  relying on it.

## Local development

```bash
npm ci
npm run dev
```

`DATABASE_URL` và các biến runtime chỉ nằm trong môi trường local/Coolify; không
commit hoặc in giá trị ra log.

## Validation

Run only the commands applicable to the affected scope; required CI remains the
merge gate:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Codex and delivery

Một phiên Codex chỉ cần đọc [AGENTS.md](AGENTS.md) để nắm mục tiêu, công việc
đang làm, cấu trúc ứng dụng, nghiệp vụ và quy trình phát hành. Chi tiết được
**tổng hợp duy nhất** tại [Project Handbook](docs/PROJECT.md), đọc khi cần.

Merge PR không đồng nghĩa với Production. Chỉ deploy sau khi xác minh đúng
runtime/candidate và có phê duyệt, rồi kiểm tra website thật.

## Repository map

- `src/`: Next.js application
- `prisma/`: schema, migrations và seed cần thiết
- `scripts/`: quality, monitoring, SEO và canonical rollout tools
- `docs/PROJECT.md`: handbook duy nhất; `docs/deploy/` giữ những runbook còn được CI hoặc vận hành phụ thuộc
- `.github/workflows/`: quality, performance, staging image và manual candidate
