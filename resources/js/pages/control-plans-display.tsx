import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ControlPlanDataTable } from '@/components/control-plan-data-table';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
    {
        title: 'Control Plans',
        href: '#',
    },
];

export default function ControlPlansDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Control Plans" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl md:min-h-min dark:border-sidebar-border">
                    <ControlPlanDataTable />
                </div>
            </div>
        </AppLayout>
    );
}
