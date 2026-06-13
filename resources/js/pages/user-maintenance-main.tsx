import { RoleDataTable } from '@/components/role-table';
import { UserManagementStatsCards } from '@/components/user-management-stats-cards';
import { UserDataTable } from '@/components/user-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '' },
    { title: 'User & Role Management', href: '' },
];

export default function UserMaintenancePage() {
    const { can } = usePermissions();
    const canManageRoles = can('roles.manage');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User & Role Management" />
            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <UserManagementStatsCards />

                        <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                            <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl md:min-h-min dark:border-sidebar-border">
                                {canManageRoles ? (
                                    <Tabs defaultValue="users">
                                        <TabsList>
                                            <TabsTrigger value="users">Users</TabsTrigger>
                                            <TabsTrigger value="roles">Roles</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="users">
                                            <UserDataTable />
                                        </TabsContent>
                                        <TabsContent value="roles">
                                            <RoleDataTable />
                                        </TabsContent>
                                    </Tabs>
                                ) : (
                                    <UserDataTable />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
