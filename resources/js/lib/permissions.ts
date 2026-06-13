import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

export function usePermissions() {
    const { auth } = usePage<SharedData>().props;
    const permissions = auth.permissions ?? [];
    const roles = auth.roles ?? [];

    return {
        can: (permission: string) => permissions.includes(permission),
        hasRole: (role: string) => roles.includes(role),
        permissions,
        roles,
    };
}
