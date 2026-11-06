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

## Codex and release

Codex tự động đọc [AGENTS.md](AGENTS.md), chỉ đọc [CONTEXT.md](CONTEXT.md)
khi cần ngữ cảnh nghiệp vụ. Không cần đọc toàn bộ `docs/` để bắt đầu.

Một PR đã merge **không** có nghĩa đã deploy. Phải xác minh hệ thống đang phục
vụ Production, nhận phê duyệt đúng bản phát hành, và kiểm tra website thật.
Xem [quy trình mở rộng](docs/WORKFLOW-WITH-CODEX.md) khi cần; xem
[isolated Staging foundation](docs/deploy/isolated-staging-foundation.md)
chỉ với các thay đổi dữ liệu cần môi trường cách ly.

## Repository map

- `src/`: Next.js application
- `prisma/`: schema, migrations và seed cần thiết
- `scripts/`: quality, monitoring, SEO và canonical rollout tools
- `docs/`: application reference, workflow, sitemap và staging runbook
- `.github/workflows/`: quality, performance, staging image và manual candidate
