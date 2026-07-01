import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Pre-compiled redirect map (source → destination) ────────
// Generated from the redirects table via scripts/db/export-product-redirect-map.mts
import redirectData from "@/data/product-redirect-map.json";

const redirectMap = new Map<string, string>(Object.entries(redirectData));
const CANONICAL_HOST = "www.dongphugia.com.vn";
const LEGACY_HOSTS = new Set(["dongphugia.com.vn"]);

// ============================================================
// MIDDLEWARE: Maintenance Mode + Product Slug Redirects
// ============================================================

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

const BYPASS_PATHS = [
  "/maintenance",
  "/admin",
  "/api",
  "/_next",
  "/favicon.ico",
  "/images",
  "/banners",
  "/icons",
  "/fonts",
  "/og",
  "/robots.txt",
  "/sitemap.xml",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const search = request.nextUrl.search || "";

  if (LEGACY_HOSTS.has(request.nextUrl.hostname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = CANONICAL_HOST;
    redirectUrl.protocol = "https:";
    return NextResponse.redirect(redirectUrl, 301);
  }

  // Skip static/admin/api paths
  if (BYPASS_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // ── Maintenance mode ──
  if (MAINTENANCE_MODE) {
    const maintenanceUrl = new URL("/maintenance", request.url);
    return NextResponse.rewrite(maintenanceUrl);
  }

  // ── Product slug 301 redirects ──
  const destination = redirectMap.get(`${pathname}${search}`) || redirectMap.get(pathname);
  if (destination) {
    const redirectUrl = new URL(destination, request.url);
    return NextResponse.redirect(redirectUrl, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude static assets from middleware invocations to reduce Edge Requests
    // This covers: Next.js internals, images, fonts, icons, and common static file types
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js\\.map)).*)",
  ],
};
