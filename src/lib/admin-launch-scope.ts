const ADMIN_LOGIN_PATH = '/admin/login'
const PRODUCTS_PATH = '/admin/products'
const BLOG_POSTS_PATH = '/admin/blog/posts'

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
