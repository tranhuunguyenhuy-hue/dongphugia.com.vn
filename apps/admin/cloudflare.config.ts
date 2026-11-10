import { bindings, defineConfig, defineWorker } from "cf/config";

const previewOrigin = "https://dongphugia-phase2-admin-preview-290.tranhuunguyenhuy.workers.dev";
const supabaseUrl = "https://uybumsnyqpwcidjxmfsv.supabase.co";
const publishableKey = process.env.PREVIEW_SUPABASE_PUBLISHABLE_KEY?.trim();
const sourceSha = process.env.BUILD_SOURCE_SHA?.trim();

if (!publishableKey?.startsWith("sb_publishable_")) {
  throw new Error("ADMIN_PREVIEW_SUPABASE_PUBLISHABLE_KEY_REQUIRED");
}
if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
  throw new Error("ADMIN_PREVIEW_SOURCE_SHA_REQUIRED");
}

Object.assign(process.env, {
  APP_ENV: "preview",
  APP_BUILD_TARGET: "admin",
  APP_ORIGIN: previewOrigin,
  PREVIEW_NOINDEX: "true",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
});

export default defineConfig({
  worker: defineWorker({
    name: "dongphugia-phase2-admin-preview-290",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-10",
    compatibilityFlags: ["nodejs_compat"],
    workersDev: true,
    previewUrls: false,
    domains: [],
    cache: { enabled: false },
    observability: { enabled: false },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      APP_ENV: bindings.text("preview"),
      APP_BUILD_TARGET: bindings.text("admin"),
      APP_ORIGIN: bindings.text(previewOrigin),
      PREVIEW_NOINDEX: bindings.text("true"),
      BUILD_SOURCE_SHA: bindings.text(sourceSha),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text(publishableKey),
    },
  }),
});
