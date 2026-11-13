# V1 Public — Cloudflare deployment runtime

**Current roadmap:** [AGENTS.md](../../AGENTS.md) → [M1 Issue #307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307).

This deployable serves `https://www.dongphugia.vn` on existing Worker `dongphugia-v1-public-production`. The verified earlier release was **snapshot-backed**; the urgent M1 task is to reconcile all recovered Products and Blog in **V1 Supabase PostgreSQL** and prove that deployed Public now reads them (cached DB reads permitted). Do not simply load DB while leaving all Public reads pointed to the bundled snapshot.

Preserve the approved Public UI/SEO/media/price provenance and retain a tested snapshot fallback before DB cutover. After M1, M2 mirrors this UI in the existing `dpg-staging`; Public Staging **may use snapshot**. No remote PR Preview is required. Do not expose Staff/Admin secrets in this bundle.

See `docs/deploy/postgresql-production-adoption-contract.md`, `docs/deploy/cloudflare-staging-production.md`. Existing scripts must be inspected for real build commands instead of trusting old handoff text.
