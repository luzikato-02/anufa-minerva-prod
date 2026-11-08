import { ActivityLogTable } from '@/components/activity-log-table';
import { PageHeader } from '@/components/page-header';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Activity Log', href: '/activity-log' },
];

export default function ActivityLogPage() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Activity Log" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Activity Log"
                    meta="Changes and sign-ins across the app"
                />
                <ActivityLogTable />
            </div>
        </AppLayout>
    );
}
