// Role definitions matching prisma schema admin_users.role
export type AdminRole = 'admin' | 'sale_manager' | 'sale'

// Permission strings used across the system
export type Permission =
    | 'orders:read'
    | 'orders:read_assigned'   // Sale: only their own assigned orders
    | 'orders:update_status'
    | 'orders:assign'
    | 'orders:cancel'
    | 'orders:edit_note'
    | 'orders:edit'            // Full order edit (items, pricing)
    | 'orders:delete'
    | 'quotes:read'
    | 'quotes:create'
    | 'quotes:update'
    | 'quotes:delete'
    | 'customers:read'
    | 'customers:write'
    | 'products:read'
    | 'products:write'
    | 'products:delete'
    | 'categories:read'
    | 'categories:write'
    | 'blog:read'
    | 'blog:write'
    | 'users:read'
    | 'users:write'
    | 'dashboard:read'
    | 'dashboard:read_own'
    | 'reports:read'
    | '*'

const PERMISSIONS: Record<AdminRole, Permission[]> = {
    admin: ['*'],

    sale_manager: [
        'orders:read',
        'orders:update_status',
        'orders:assign',
        'orders:cancel',
        'orders:edit_note',
        'quotes:read',
        'quotes:create',
        'quotes:update',
        'customers:read',
        'customers:write',
        'products:read',
        'categories:read',
        'dashboard:read',
        'reports:read',
    ],

    sale: [
        'orders:read_assigned',
        'orders:update_status',
        'orders:edit_note',
        'quotes:read',
        'quotes:create',
        'quotes:update',
        'customers:read',
        'products:read',
        'dashboard:read_own',
    ],
}

/** Check if a role has a specific permission. Admin wildcard always returns true. */
export function can(role: AdminRole, permission: Permission): boolean {
    const perms = PERMISSIONS[role] ?? []
    if (perms.includes('*')) return true
    return perms.includes(permission)
}

/** Get all permissions for a role. */
export function getPermissions(role: AdminRole): Permission[] {
    return PERMISSIONS[role] ?? []
}

/** Role display names for UI */
export const ROLE_LABELS: Record<AdminRole, string> = {
    admin: 'Quản trị viên',
    sale_manager: 'Sale Manager',
    sale: 'Nhân viên Sale',
}

/** Role badge colors */
export const ROLE_COLORS: Record<AdminRole, string> = {
    admin: 'bg-purple-100 text-purple-700',
    sale_manager: 'bg-blue-100 text-blue-700',
    sale: 'bg-green-100 text-green-700',
}
