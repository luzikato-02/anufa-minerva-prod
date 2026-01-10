import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface CanProps {
    children: ReactNode;
    permission?: string | string[];
    role?: string | string[];
    fallback?: ReactNode;
}

/**
 * Component to conditionally render children based on user permissions or roles
 * 
 * @example
 * <Can permission="users.create">
 *   <CreateUserButton />
 * </Can>
 * 
 * @example
 * <Can role={['admin', 'super-admin']}>
 *   <AdminPanel />
 * </Can>
 * 
 * @example
 * <Can permission="users.delete" fallback={<span>Not authorized</span>}>
 *   <DeleteButton />
 * </Can>
 */
export function Can({ children, permission, role, fallback = null }: CanProps) {
    const { hasPermission, hasRole } = usePermissions();

    let authorized = false;

    if (permission) {
        authorized = hasPermission(permission);
    }

    if (role) {
        authorized = authorized || hasRole(role);
    }

    // If neither permission nor role is specified, render children
    if (!permission && !role) {
        authorized = true;
    }

    return authorized ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component to conditionally render children if user does NOT have permission/role
 */
export function Cannot({ children, permission, role, fallback = null }: CanProps) {
    const { hasPermission, hasRole } = usePermissions();

    let authorized = false;

    if (permission) {
        authorized = hasPermission(permission);
    }

    if (role) {
        authorized = authorized || hasRole(role);
    }

    return !authorized ? <>{children}</> : <>{fallback}</>;
}
