import { type KpiItem, KpiStrip } from '@/components/kpi-strip';
import { useJson } from '@/hooks/use-json';

interface UserManagementStats {
    total_users: number;
    total_roles: number;
    total_permissions: number;
    unassigned_users: number;
}

/** Key figures for user & role management, from /user-management-statistics. */
export function UserKpiStrip({ className }: { className?: string }) {
    const {
        data: stats,
        error,
        retry,
    } = useJson<UserManagementStats>('/user-management-statistics');

    const items: KpiItem[] = stats
        ? [
              { label: 'Users', value: stats.total_users, sub: 'accounts' },
              {
                  label: 'Without a role',
                  value: stats.unassigned_users,
                  sub: stats.unassigned_users
                      ? 'can’t use any module yet'
                      : 'everyone has a role',
                  tone: stats.unassigned_users ? 'bad' : 'good',
              },
              { label: 'Roles', value: stats.total_roles, sub: 'defined' },
              {
                  label: 'Permissions',
                  value: stats.total_permissions,
                  sub: 'available to assign',
              },
          ]
        : [];

    return (
        <KpiStrip
            label="User key figures"
            className={className}
            loading={!stats && !error}
            error={error}
            onRetry={retry}
            items={items}
        />
    );
}
