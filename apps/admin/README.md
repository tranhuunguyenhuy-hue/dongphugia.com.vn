# Admin Application

This is the independent staff-only application. The bounded Phase 2 Preview
uses the separate Worker `dongphugia-phase2-admin-preview-290` at
`https://dongphugia-phase2-admin-preview-290.tranhuunguyenhuy.workers.dev`.
The Production origin remains `https://admin.dongphugia.vn` and is outside the
Preview deployment contract.

The shell intentionally contains no legacy `/admin` implementation, Public
runtime, Public cookie, direct database adapter, or Admin feature UI. LEO-564
owns the minimal Supabase Auth SSR lifecycle, RLS/service interfaces, and the
narrow backend-only Auth Admin adapter. LEO-572 owns the approved Admin
feature UI.

The Cloudflare Worker build uses pinned `vinext` and `cf` dependencies. Run
`BUILD_SOURCE_SHA=<40-char-sha> PREVIEW_SUPABASE_PUBLISHABLE_KEY=... npm --prefix apps/admin run build:vinext`
to build the isolated Preview bundle. Admin routes remain staff-gated through
Supabase Auth and database capabilities; responses are private/no-store and
noindex. The visible Preview banner appears on every route.
