export const APPLICATION_CONTRACT_VERSION = 'dongphugia:application-foundation:v1'

export const APPLICATIONS = {
  public: {
    name: 'public',
    authority: 'https://www.dongphugia.vn',
    runtime: 'cloudflare-worker-static-assets',
    cachePolicy: 'public-eligible-only',
  },
  admin: {
    name: 'admin',
    authority: 'https://admin.dongphugia.vn',
    runtime: 'independent-private-runtime',
    cachePolicy: 'private-no-store',
  },
} as const

export type ApplicationName = keyof typeof APPLICATIONS

export const PUBLIC_ROUTE_OWNERSHIP = [
  { path: '/', owner: 'public', purpose: 'application-shell' },
  { path: '/robots.txt', owner: 'public', purpose: 'crawler-policy' },
  { path: '/api/health', owner: 'public', purpose: 'runtime-probe' },
] as const

export const ADMIN_ROUTE_OWNERSHIP = [
  { path: '/', owner: 'admin', purpose: 'application-shell' },
  { path: '/login', owner: 'admin', purpose: 'staff-auth-shell' },
  { path: '/robots.txt', owner: 'admin', purpose: 'crawler-policy' },
  { path: '/api/health', owner: 'admin', purpose: 'runtime-probe' },
] as const

export const PUBLIC_EDGE_CACHE_SECONDS = 300

export const PUBLIC_PREVIEW_NOINDEX = {
  htmlMeta: 'noindex,nofollow',
  responseHeader: 'noindex, nofollow',
  robotsDirective: 'Disallow: /',
} as const

export const ADMIN_PRIVATE_CACHE_CONTROL = 'private, no-store'
