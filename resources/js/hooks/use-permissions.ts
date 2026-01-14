import { usePage } from '@inertiajs/react';

interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles?: string[];
    permissions?: string[];
}

interface PageProps {
    auth?: {
        user?: AuthUser;
    };
}

export function usePermissions() {
    const page = usePage<PageProps>();
    const user = page.props.auth?.user;
    const roles = user?.roles || [];
    const permissions = user?.permissions || [];

    /**
     * Check if user has a specific role
     */
    const hasRole = (role: string | string[]): boolean => {
        if (Array.isArray(role)) {
            return role.some(r => roles.includes(r));
        }
        return roles.includes(role);
    };

    /**
     * Check if user has a specific permission
     */
    const hasPermission = (permission: string | string[]): boolean => {
        if (Array.isArray(permission)) {
            return permission.some(p => permissions.includes(p));
        }
        return permissions.includes(permission);
    };

    /**
     * Check if user has any of the specified roles or permissions
     */
    const hasAny = (rolesOrPermissions: string[]): boolean => {
        return rolesOrPermissions.some(
            item => roles.includes(item) || permissions.includes(item)
        );
    };

    /**
     * Check if user is an admin
     */
    const isAdmin = hasRole(['admin', 'super-admin']);

    /**
     * Check if user is a super admin
     */
    const isSuperAdmin = hasRole('super-admin');

    return {
        user,
        roles,
        permissions,
        hasRole,
        hasPermission,
        hasAny,
        isAdmin,
        isSuperAdmin,
    };
}
