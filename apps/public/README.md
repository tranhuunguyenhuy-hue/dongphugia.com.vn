# V1 Public — Cloudflare deployment runtime

**Current roadmap:** [AGENTS.md](../../AGENTS.md) → [M1 Issue #307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307).

This deployable serves `https://www.dongphugia.vn` on existing Worker `dongphugia-v1-public-production`. The verified earlier release was **snapshot-backed**; the urgent M1 task is to reconcile all recovered Products and Blog in **V1 Supabase PostgreSQL** and prove that deployed Public now reads them (cached DB reads permitted). Do not simply load DB while leaving all Public reads pointed to the bundled snapshot.

Preserve approved Public UI/SEO/media/price provenance and snapshot fallback. M2 mirrors UI using **one named Preview `staging` INSIDE the existing Production Worker**; Public Preview may use read-only snapshot. Do not deploy to separate `dpg-staging` Worker or automatically create per-PR Previews. Do not expose staff secrets in Public/client.

See `docs/deploy/postgresql-production-adoption-contract.md`, `docs/deploy/cloudflare-fixed-preview-production.md`. Existing scripts must be inspected for real build commands instead of trusting old handoff text.
