# Đông Phú Gia

Website catalogue và báo giá của Đông Phú Gia.

- Public production: `https://www.dongphugia.vn`
- Runtime: AWS EC2/Coolify với immutable ARM64 image
- Database production duy nhất: AWS PostgreSQL
- Media: Bunny CDN
- Default branch: protected `main`

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

## Release gates

Merge source không tự deploy. Quy trình approval, candidate, Staging và
Production nằm trong [workflow](docs/WORKFLOW-WITH-CODEX.md) và
[staging runbook](docs/deploy/staging-coolify.md).

## Repository map

- `src/`: Next.js application
- `prisma/`: schema, migrations và seed cần thiết
- `scripts/`: quality, monitoring, SEO và canonical rollout tools
- `docs/`: application reference, workflow, sitemap và staging runbook
- `.github/workflows/`: quality, performance, staging image và manual candidate
