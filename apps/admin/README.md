# V1 Admin — historical separate application shell

**This directory is NOT the chosen Admin restoration target.** Under the Owner's 2026-11-13 approved Option A / M3–M4, agents must restore and reuse the **legacy Admin in `src/app/admin/`**, served on Cloudflare under `/admin` on the same Staging and Production Workers as Public.

The older `apps/admin/` separate deployable and `admin.dongphugia.vn` objective were superseded. Do not extend this shell, wire it to Production data, or build a competing Admin architecture without a new Owner decision. Preserve its source code as historical implementation evidence; it can be read for reusable modules after verification.

References: [AGENTS.md](../../AGENTS.md), [M3 #309](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/309), [M4 #310](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/310). Existing recovered legacy source PR #300, local Workerd prototype PR #301 and DB-role PR #304 are reference only. Full functional Staging authentication, per-module checklist and isolated database are mandatory before release.
