import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============================================================
// MAINTENANCE MODE MIDDLEWARE
// Set MAINTENANCE_MODE=true in environment to enable.
// When enabled, ALL public traffic redirects to /maintenance.
// Admin routes and static assets are excluded.
// ============================================================

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

// Routes that should bypass maintenance mode
const BYPASS_PATHS = [
  "/maintenance",
  "/admin",
  "/api",
  "/_next",
  "/favicon.ico",
  "/images",
  "/banners",
  "/robots.txt",
  "/sitemap.xml",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip if maintenance mode is off
  if (!MAINTENANCE_MODE) {
    return NextResponse.next();
  }

  // Skip bypass paths
  if (BYPASS_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Redirect all other traffic to maintenance page
  const maintenanceUrl = new URL("/maintenance", request.url);
  return NextResponse.rewrite(maintenanceUrl);
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
