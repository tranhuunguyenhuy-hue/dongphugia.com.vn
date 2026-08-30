# Public Application

This is the independent New Production Public deployable for
`https://www.dongphugia.vn`.

The shell intentionally contains no catalogue UI, legacy UI composition,
Supabase service client, staff session code, or Admin routes. Its approved
Production runtime target is a Cloudflare Worker with Static Assets; the
Worker adapter and external Preview resource remain a later, separately gated
delivery concern.

Build it from the repository root with `npm run build:public`. The root lockfile
pins the shared toolchain, while this application owns its own Next config,
environment validation, route tree, and build output.
