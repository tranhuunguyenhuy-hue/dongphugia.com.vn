const ADMIN_LOGIN_PATH = '/admin/login'
const PRODUCTS_PATH = '/admin/products'
const BLOG_POSTS_PATH = '/admin/blog/posts'

export type AdminLaunchModule =
    | 'products'
    | 'blog-posts'
    | 'orders'
    | 'customers'
    | 'quote-requests'
    | 'dashboard'
    | 'banners'
    | 'categories'
    | 'pim'
    | 'partners'
    | 'projects'
    | 'users'
    | 'blog-tags'

const ENABLED_ADMIN_LAUNCH_MODULES = new Set<AdminLaunchModule>(['products', 'blog-posts'])

export function assertAdminLaunchModuleEnabled(module: AdminLaunchModule) {
    if (!ENABLED_ADMIN_LAUNCH_MODULES.has(module)) {
        throw new Error('ADMIN_LAUNCH_SCOPE_DENIED')
    }
}

function normalizePath(pathname: string) {
    const withoutTrailingSlashes = pathname.replace(/\/+$/, '')
    return withoutTrailingSlashes || '/'
}

export function isAdminLaunchHomePath(pathname: string) {
    return normalizePath(pathname) === '/admin'
}

export function isAdminLaunchPathAllowed(pathname: string) {
    const path = normalizePath(pathname)
    return path === ADMIN_LOGIN_PATH
        || path === PRODUCTS_PATH
        || path.startsWith(`${PRODUCTS_PATH}/`)
        || path === BLOG_POSTS_PATH
        || path.startsWith(`${BLOG_POSTS_PATH}/`)
}
