# V1 Admin — historical separate application shell

**This directory is NOT the selected legacy Admin source.** For M3–M4 use `src/app/admin/` at `/admin` on the **same Cloudflare Worker**: first full functionality on its **fixed Preview `staging`** (isolated test DB, own Hyperdrive, real Auth), then accepted Production deployment.

The older `apps/admin/` separate deployable and `admin.dongphugia.vn` objective were superseded. Do not extend this shell, wire it to Production data, or build a competing Admin architecture without a new Owner decision. Preserve its source code as historical implementation evidence; it can be read for reusable modules after verification.

References: [AGENTS.md](../../AGENTS.md), [M3 #309](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/309), [M4 #310](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/310). PR #300/#301/#304 are source references. Owner **authorizes full legacy Admin, Hyperdrive, real authentication and required features on the fixed Preview**. Isolation from Production writes, secure cookies/secrets, every module's test evidence and browser/login checks are mandatory before release.
