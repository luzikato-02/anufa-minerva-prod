import { PageHeader } from '@/components/page-header';
import { RoleDataTable } from '@/components/role-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserKpiStrip } from '@/components/user-kpi-strip';
import { UserDataTable } from '@/components/user-table';
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
            <div className="@container/main flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <UserKpiStrip />
                {canManageRoles ? (
                    <Tabs
                        defaultValue="users"
                        className="flex min-w-0 flex-col gap-(--density-gutter)"
                    >
                        <PageHeader
                            title="Users & Roles"
                            meta="Accounts, roles and what each role can do"
                            tabs={
                                <TabsList className="h-8">
                                    <TabsTrigger
                                        value="users"
                                        className="text-xs"
                                    >
                                        Users
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="roles"
                                        className="text-xs"
                                    >
                                        Roles
                                    </TabsTrigger>
                                </TabsList>
                            }
                        />
                        <TabsContent value="users" className="mt-0">
                            <UserDataTable />
                        </TabsContent>
                        <TabsContent value="roles" className="mt-0">
                            <RoleDataTable />
                        </TabsContent>
                    </Tabs>
                ) : (
                    <>
                        <PageHeader
                            title="Users"
                            meta="Accounts and their roles"
                        />
                        <UserDataTable />
                    </>
                )}
            </div>
        </AppLayout>
    );
}
