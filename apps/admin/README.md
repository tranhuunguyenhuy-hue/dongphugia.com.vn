# Admin Application

This is the independent New Production staff-only deployable for
`https://admin.dongphugia.vn`.

The shell intentionally contains no legacy `/admin` implementation, Public
runtime, Public cookie, direct database adapter, or Supabase Auth lifecycle.
LEO-564 owns Auth/RLS/service interfaces and LEO-572 owns the approved Admin
feature UI.

Build it from the repository root with `npm run build:admin`. The root lockfile
pins the shared toolchain, while this application owns its own Next config,
environment validation, private cache policy, route tree, and build output.
